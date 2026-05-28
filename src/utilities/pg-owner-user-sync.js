import mongoose from 'mongoose';
import models from '../models/index.js';

const User = models.User;
const PgOwner = models.PgOwner;

function rawPhone(phone) {
    if (phone == null || phone === '') return null;
    return String(phone).replace(/\s+/g, '').trim();
}

/** Preferred storage for new users (10-digit IN → +91…). */
function normalizePhone(phone) {
    const p = rawPhone(phone);
    if (!p) return null;
    if (p.startsWith('+')) return p;
    if (/^\d{10}$/.test(p)) return `+91${p}`;
    if (p.length === 12 && p.startsWith('91')) return `+${p}`;
    return p;
}

function phoneLookupVariants(phone) {
    const p = rawPhone(phone);
    if (!p) return [];
    const set = new Set([p, normalizePhone(p)].filter(Boolean));
    if (/^\d{10}$/.test(p)) {
        set.add(`+91${p}`);
        set.add(`91${p}`);
    }
    const normalized = normalizePhone(p);
    if (normalized?.startsWith('+91') && normalized.length > 3) {
        set.add(normalized.slice(3));
    }
    return [...set];
}

function normalizeEmail(email) {
    if (email == null || email === '') return null;
    return String(email).trim().toLowerCase();
}

/**
 * Map PgOwner fields → User document fields (vendor).
 */
export function pgOwnerToUserPayload(pgOwner) {
    const phone_number = normalizePhone(pgOwner.phone);
    const email = normalizeEmail(pgOwner.email);
    const payload = {
        name: pgOwner.name ? String(pgOwner.name).trim() : undefined,
        email: email || undefined,
        role: 'vendor',
        roles: ['vendor'],
        login_type: 'spacehaat',
        is_active: pgOwner.delete === true ? false : pgOwner.active !== false,
        is_profile_updated: true,
        is_mobile_verified: !!phone_number,
        is_email_verified: !!pgOwner.isEmailVerify,
    };
    if (phone_number) {
        payload.phone_number = phone_number;
        if (phone_number.startsWith('+91') && phone_number.length > 3) {
            payload.dial_code = '+91';
        }
    }
    return payload;
}

async function findUserByPhoneOrEmail(phone, email) {
    const or = [];
    const variants = phoneLookupVariants(phone);
    if (variants.length) or.push({ phone_number: { $in: variants } });
    const em = normalizeEmail(email);
    if (em) or.push({ email: em });
    if (!or.length) return null;
    return User.findOne(or.length > 1 ? { $or: or } : or[0]);
}

/**
 * Ensure a vendor User exists for PgOwner data; link via userId on PgOwner.
 * @returns {{ user: object, userId: ObjectId, created: boolean, linked: boolean }}
 */
export async function ensureVendorUserForPgOwner(pgOwner, { updateExisting = true } = {}) {
    if (!pgOwner) {
        throw new Error('pgOwner is required');
    }

    const phone_number = normalizePhone(pgOwner.phone) || rawPhone(pgOwner.phone);
    if (!phone_number) {
        return { user: null, userId: null, created: false, linked: false, skipped: true, reason: 'missing_phone' };
    }

    if (pgOwner.userId && mongoose.Types.ObjectId.isValid(String(pgOwner.userId))) {
        const existing = await User.findById(pgOwner.userId);
        if (existing) {
            if (updateExisting) {
                const patch = pgOwnerToUserPayload(pgOwner);
                delete patch.phone_number;
                delete patch.roles;
                await User.updateOne(
                    { _id: existing._id },
                    {
                        $set: patch,
                        $addToSet: { roles: 'vendor' },
                    },
                );
            }
            return {
                user: existing,
                userId: existing._id,
                created: false,
                linked: true,
                skipped: false,
            };
        }
    }

    let user = await findUserByPhoneOrEmail(pgOwner.phone, pgOwner.email);
    let created = false;

    if (!user) {
        const payload = pgOwnerToUserPayload(pgOwner);
        payload.phone_number = phone_number;
        user = await User.create(payload);
        created = true;
    } else if (updateExisting) {
        const patch = pgOwnerToUserPayload(pgOwner);
        delete patch.phone_number;
        delete patch.roles;
        await User.updateOne(
            { _id: user._id },
            {
                $set: patch,
                $addToSet: { roles: 'vendor' },
            },
        );
    }

    if (pgOwner._id) {
        await PgOwner.updateOne(
            { _id: pgOwner._id },
            { $set: { userId: user._id } },
        );
    }

    return {
        user,
        userId: user._id,
        created,
        linked: true,
        skipped: false,
    };
}

function buildUserLookupIndexes(users) {
    const byId = new Map();
    const byPhone = new Map();
    const byEmail = new Map();

    for (const user of users) {
        byId.set(String(user._id), user);
        if (user.phone_number) {
            for (const variant of phoneLookupVariants(user.phone_number)) {
                if (!byPhone.has(variant)) byPhone.set(variant, user);
            }
        }
        const em = normalizeEmail(user.email);
        if (em && !byEmail.has(em)) byEmail.set(em, user);
    }

    return { byId, byPhone, byEmail };
}

function lookupUserFromIndexes(owner, indexes) {
    if (owner.userId && indexes.byId.has(String(owner.userId))) {
        return indexes.byId.get(String(owner.userId));
    }
    for (const variant of phoneLookupVariants(owner.phone)) {
        if (indexes.byPhone.has(variant)) return indexes.byPhone.get(variant);
    }
    const em = normalizeEmail(owner.email);
    if (em && indexes.byEmail.has(em)) return indexes.byEmail.get(em);
    return null;
}

function registerUserInIndexes(user, indexes) {
    indexes.byId.set(String(user._id), user);
    if (user.phone_number) {
        for (const variant of phoneLookupVariants(user.phone_number)) {
            if (!indexes.byPhone.has(variant)) indexes.byPhone.set(variant, user);
        }
    }
    const em = normalizeEmail(user.email);
    if (em && !indexes.byEmail.has(em)) indexes.byEmail.set(em, user);
}

/**
 * Backfill: create/link vendor Users for all PgOwners.
 */
export async function syncAllPgOwnersToVendorUsers({ dryRun = false } = {}) {
    const owners = await PgOwner.find({ delete: { $ne: true } }).lean();
    const users = await User.find({}).select('_id phone_number email role roles').lean();
    const indexes = buildUserLookupIndexes(users);

    const stats = {
        total: owners.length,
        created: 0,
        linked: 0,
        updated: 0,
        skipped: 0,
        errors: [],
    };

    const BATCH = 200;
    const toCreate = [];
    const toLink = [];

    for (const owner of owners) {
        const phone_number = normalizePhone(owner.phone) || rawPhone(owner.phone);
        if (!phone_number) {
            stats.skipped += 1;
            continue;
        }

        const existing = lookupUserFromIndexes(owner, indexes);

        if (dryRun) {
            if (existing) stats.linked += 1;
            else stats.created += 1;
            continue;
        }

        if (existing) {
            toLink.push({ owner, user: existing });
        } else {
            const payload = pgOwnerToUserPayload(owner);
            payload.phone_number = phone_number;
            toCreate.push({ owner, payload });
        }
    }

    if (dryRun) return stats;

    for (let i = 0; i < toCreate.length; i += BATCH) {
        const slice = toCreate.slice(i, i + BATCH);
        const payloads = slice.map((row) => row.payload);
        try {
            const inserted = await User.insertMany(payloads, { ordered: false });
            inserted.forEach((user, idx) => {
                stats.created += 1;
                registerUserInIndexes(user.toObject ? user.toObject() : user, indexes);
                toLink.push({ owner: slice[idx].owner, user });
            });
        } catch (e) {
            const inserted = e.insertedDocs || [];
            const insertedByPhone = new Map();
            for (const user of inserted) {
                stats.created += 1;
                const plain = user.toObject ? user.toObject() : user;
                registerUserInIndexes(plain, indexes);
                insertedByPhone.set(plain.phone_number, plain);
            }
            for (const row of slice) {
                const phone = row.payload.phone_number;
                if (insertedByPhone.has(phone)) {
                    toLink.push({ owner: row.owner, user: insertedByPhone.get(phone) });
                    continue;
                }
                try {
                    const result = await ensureVendorUserForPgOwner(row.owner, {
                        updateExisting: true,
                    });
                    if (!result.skipped) {
                        if (result.created) stats.created += 1;
                        registerUserInIndexes(result.user, indexes);
                        toLink.push({ owner: row.owner, user: result.user });
                    }
                } catch (err) {
                    stats.errors.push({
                        pgOwnerId: String(row.owner._id),
                        phone: row.owner.phone,
                        email: row.owner.email,
                        message: err.message,
                    });
                }
            }
        }
    }

    for (let i = 0; i < toLink.length; i += BATCH) {
        const slice = toLink.slice(i, i + BATCH);
        const userBulk = [];
        const pgOwnerBulk = [];

        for (const { owner, user } of slice) {
            const patch = pgOwnerToUserPayload(owner);
            delete patch.phone_number;
            delete patch.roles;
            userBulk.push({
                updateOne: {
                    filter: { _id: user._id },
                    update: { $set: patch, $addToSet: { roles: 'vendor' } },
                },
            });
            if (String(owner.userId) !== String(user._id)) {
                pgOwnerBulk.push({
                    updateOne: {
                        filter: { _id: owner._id },
                        update: { $set: { userId: user._id } },
                    },
                });
            }
            stats.linked += 1;
        }

        if (userBulk.length) {
            await User.bulkWrite(userBulk, { ordered: false });
            stats.updated += slice.length;
        }
        if (pgOwnerBulk.length) {
            await PgOwner.bulkWrite(pgOwnerBulk, { ordered: false });
        }
    }

    return stats;
}
