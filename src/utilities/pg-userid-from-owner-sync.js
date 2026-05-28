import mongoose from 'mongoose';
import models from '../models/index.js';

const PG = models.PG;
const PgOwner = models.PgOwner;
const User = models.User;

function isValidObjectId(value) {
    if (value == null || value === '') return false;
    return mongoose.Types.ObjectId.isValid(String(value));
}

function toObjectId(value) {
    return new mongoose.Types.ObjectId(String(value));
}

function rawPhone(phone) {
    if (phone == null || phone === '') return null;
    return String(phone).replace(/\s+/g, '').trim();
}

function phoneLookupVariants(phone) {
    const p = rawPhone(phone);
    if (!p) return [];
    const set = new Set([p]);
    if (/^\d{10}$/.test(p)) {
        set.add(`+91${p}`);
        set.add(`91${p}`);
    }
    if (p.startsWith('+91') && p.length > 3) set.add(p.slice(3));
    return [...set];
}

function normalizeEmail(email) {
    if (email == null || email === '') return null;
    return String(email).trim().toLowerCase();
}

function ownerSlotId(slot) {
    if (slot instanceof mongoose.Types.ObjectId) return String(slot);
    if (typeof slot === 'object' && slot?._id && isValidObjectId(slot._id)) return String(slot._id);
    if (isValidObjectId(slot)) return String(slot);
    return null;
}

function buildPgOwnerIndexes(owners) {
    const byId = new Map();
    const byUserId = new Map();
    const byPhone = new Map();
    const byEmail = new Map();

    for (const row of owners) {
        byId.set(String(row._id), row);
        if (row.userId != null) byUserId.set(String(row.userId), row);
        for (const variant of phoneLookupVariants(row.phone)) {
            if (!byPhone.has(variant)) byPhone.set(variant, row);
        }
        const em = normalizeEmail(row.email);
        if (em && !byEmail.has(em)) byEmail.set(em, row);
    }

    return { byId, byUserId, byPhone, byEmail };
}

function buildUserIndex(users) {
    const byId = new Map();
    for (const user of users) {
        byId.set(String(user._id), user);
    }
    return byId;
}

function findPgOwnerByUserRef(user, indexes) {
    if (!user) return null;
    for (const variant of phoneLookupVariants(user.phone_number)) {
        const row = indexes.byPhone.get(variant);
        if (row) return row;
    }
    const em = normalizeEmail(user.email);
    if (em) {
        const row = indexes.byEmail.get(em);
        if (row) return row;
    }
    return null;
}

/**
 * Resolve PgOwner from PG.owner[] refs and contact fields.
 * owner[] may store PgOwner _id, PgOwner.userId, or legacy User _id.
 */
export function resolvePgOwnerForPg(pg, indexes, usersById) {
    if (Array.isArray(pg.owner)) {
        for (const slot of pg.owner) {
            const id = ownerSlotId(slot);
            if (!id) continue;
            if (indexes.byId.has(id)) return indexes.byId.get(id);
            if (indexes.byUserId.has(id)) return indexes.byUserId.get(id);
            const legacyUser = usersById.get(id);
            const viaLegacyUser = findPgOwnerByUserRef(legacyUser, indexes);
            if (viaLegacyUser) return viaLegacyUser;
        }
    }

    const pgUser = pg.userId ? usersById.get(String(pg.userId)) : null;
    const viaPgUser = findPgOwnerByUserRef(pgUser, indexes);
    if (viaPgUser) return viaPgUser;

    for (const variant of phoneLookupVariants(pg.contactNumber)) {
        const row = indexes.byPhone.get(variant);
        if (row) return row;
    }

    const contactEmail = normalizeEmail(pg.contactEmail);
    if (contactEmail) {
        const row = indexes.byEmail.get(contactEmail);
        if (row) return row;
    }

    return null;
}

/**
 * Resolve User _id from PG.owner[] refs (PgOwner _id or legacy User _id in owner slot).
 * Returns first linked PgOwner.userId found in array order.
 */
export async function resolveUserIdFromPgOwnerRefs(ownerRefs) {
    if (!Array.isArray(ownerRefs) || !ownerRefs.length) return null;

    const ids = ownerRefs.map(ownerSlotId).filter(Boolean).map(toObjectId);
    if (!ids.length) return null;

    const owners = await PgOwner.find({
        $or: [{ _id: { $in: ids } }, { userId: { $in: ids } }],
    })
        .select('_id userId phone email')
        .lean();

    const indexes = buildPgOwnerIndexes(owners);
    const users = await User.find({ _id: { $in: ids } }).select('_id phone_number email').lean();
    const usersById = buildUserIndex(users);

    for (const slot of ownerRefs) {
        const id = ownerSlotId(slot);
        if (!id) continue;
        if (indexes.byId.has(id) && indexes.byId.get(id).userId) {
            return indexes.byId.get(id).userId;
        }
        if (indexes.byUserId.has(id) && indexes.byUserId.get(id).userId) {
            return indexes.byUserId.get(id).userId;
        }
        const legacyUser = usersById.get(id);
        const owner = findPgOwnerByUserRef(legacyUser, indexes);
        if (owner?.userId) return owner.userId;
    }

    return null;
}

/**
 * Resolve vendor User _id for a PG payload (owner refs + contact fallbacks).
 */
export async function resolveUserIdForPgFields({ owner, userId, contactNumber, contactEmail } = {}) {
    const fromOwner = await resolveUserIdFromPgOwnerRefs(owner);
    if (fromOwner) return fromOwner;

    const pg = { owner, userId, contactNumber, contactEmail };
    const owners = await PgOwner.find({}).select('_id userId phone email').lean();
    const indexes = buildPgOwnerIndexes(owners);

    const userIds = [];
    if (userId && isValidObjectId(userId)) userIds.push(toObjectId(userId));
    if (Array.isArray(owner)) {
        for (const slot of owner) {
            const id = ownerSlotId(slot);
            if (id) userIds.push(toObjectId(id));
        }
    }
    const users = userIds.length
        ? await User.find({ _id: { $in: userIds } }).select('_id phone_number email').lean()
        : [];
    const usersById = buildUserIndex(users);

    const resolved = resolvePgOwnerForPg(pg, indexes, usersById);
    return resolved?.userId || null;
}

/**
 * Backfill PG.userId from linked PgOwner.userId for all PG documents.
 * Overwrites when different; skips when already correct or no PgOwner match.
 */
export async function syncAllPgUserIdsFromOwners({ dryRun = false } = {}) {
    const [pgs, owners, users] = await Promise.all([
        PG.find({}).select('_id userId owner contactNumber contactEmail').lean(),
        PgOwner.find({}).select('_id userId phone email').lean(),
        User.find({}).select('_id phone_number email').lean(),
    ]);

    const indexes = buildPgOwnerIndexes(owners);
    const usersById = buildUserIndex(users);

    const stats = {
        total: pgs.length,
        updated: 0,
        alreadyCorrect: 0,
        skippedNoOwner: 0,
        skippedNoUserId: 0,
        errors: [],
    };

    const BATCH = 500;
    const bulk = [];

    for (const pg of pgs) {
        try {
            if (!Array.isArray(pg.owner) || !pg.owner.length) {
                stats.skippedNoOwner += 1;
                continue;
            }

            const owner = resolvePgOwnerForPg(pg, indexes, usersById);
            const resolvedUserId = owner?.userId || null;
            if (!resolvedUserId) {
                stats.skippedNoUserId += 1;
                continue;
            }

            const current = pg.userId != null ? String(pg.userId) : null;
            const next = String(resolvedUserId);

            if (current === next) {
                stats.alreadyCorrect += 1;
                continue;
            }

            if (dryRun) {
                stats.updated += 1;
                continue;
            }

            bulk.push({
                updateOne: {
                    filter: { _id: pg._id },
                    update: { $set: { userId: resolvedUserId } },
                },
            });

            if (bulk.length >= BATCH) {
                await PG.bulkWrite(bulk, { ordered: false });
                stats.updated += bulk.length;
                bulk.length = 0;
            }
        } catch (e) {
            stats.errors.push({
                pgId: String(pg._id),
                message: e.message,
            });
        }
    }

    if (!dryRun && bulk.length) {
        await PG.bulkWrite(bulk, { ordered: false });
        stats.updated += bulk.length;
    }

    return stats;
}
