import mongoose from 'mongoose';
import vm from 'node:vm';

import models from '../../models/index.js';
import { ensureVendorUserForPgOwner } from '../../utilities/pg-owner-user-sync.js';
import { resolveUserIdForPgFields } from '../../utilities/pg-userid-from-owner-sync.js';
import { allocateNextPgId } from '../../utilities/pg-id-format.js';
import { allocateUniquePgSlug, slugifyText } from '../../utilities/pg-slug.js';

const PG = models.PG;

function httpError(statusCode, message) {
    const err = new Error(message);
    err.name = 'cofynd';
    err.code = statusCode;
    return err;
}

function isValidObjectId(value) {
    if (value == null || value === '') return false;
    return mongoose.Types.ObjectId.isValid(String(value));
}

/**
 * Incoming PG data often stores an id in `owner[]` that matches `PgOwner.userId` (User `_id`),
 * not necessarily `PgOwner._id`, so naive `populate('owner')` returns null/slots stripped.
 * We resolve owners by `_id` or `userId`, then optionally populate nested `owner.userId` (User).
 */
function isPgOwnerLikeObject(slot) {
    return (
        slot &&
        typeof slot === 'object' &&
        !(slot instanceof mongoose.Types.ObjectId) &&
        (Object.prototype.hasOwnProperty.call(slot, 'user_id') ||
            Object.prototype.hasOwnProperty.call(slot, 'joinedAsTenant') ||
            Object.prototype.hasOwnProperty.call(slot, 'whatsapp_opt_in') ||
            Object.prototype.hasOwnProperty.call(slot, 'dailyContactCount'))
    );
}

function ownerCandidateObjectId(slot) {
    if (slot == null) return null;
    if (isPgOwnerLikeObject(slot)) return null;
    if (typeof slot === 'string') {
        return isValidObjectId(slot) ? String(slot) : null;
    }
    if (slot instanceof mongoose.Types.ObjectId) return String(slot);
    const id = typeof slot === 'object' && slot !== null ? slot._id : null;
    if (id != null && isValidObjectId(id)) return String(id);
    return null;
}

async function attachPgOwnerDetails(docs, { populateLinkedUser } = { populateLinkedUser: true }) {
    const list = (Array.isArray(docs) ? docs : [docs]).filter(Boolean);
    if (!list.length) return docs;

    const ids = new Set();
    for (const doc of list) {
        if (!Array.isArray(doc?.owner)) continue;
        for (const slot of doc.owner) {
            const id = ownerCandidateObjectId(slot);
            if (id) ids.add(id);
        }
    }
    if (!ids.size) {
        if (populateLinkedUser) {
            await models.PG.populate(list, {
                path: 'owner.userId',
                select: 'name email phone_number dial_code profile_pic',
            });
        }
        return docs;
    }

    const oidList = [...ids].map((id) => new mongoose.Types.ObjectId(id));
    const rows = await models.PgOwner.find({
        $or: [{ _id: { $in: oidList } }, { userId: { $in: oidList } }],
    }).lean();

    const byLookup = new Map();
    for (const row of rows) {
        byLookup.set(String(row._id), row);
        if (row.userId != null) byLookup.set(String(row.userId), row);
    }

    for (const doc of list) {
        if (!Array.isArray(doc.owner) || !doc.owner.length) continue;
        doc.owner = doc.owner.map((slot) => {
            const id = ownerCandidateObjectId(slot);
            if (!id) return slot;
            return byLookup.get(id) || slot;
        });
    }

    if (populateLinkedUser) {
        await models.PG.populate(list, {
            path: 'owner.userId',
            select: 'name email phone_number dial_code profile_pic',
        });
    }

    return docs;
}

/**
 * Clean `locationIds` for Mongoose: drop empty strings / invalid ObjectIds.
 */
function sanitizeLocationIdsInPlace(locationIds) {
    if (!locationIds || typeof locationIds !== 'object') {
        return;
    }
    const { country, state, city } = locationIds;
    if (!isValidObjectId(country)) delete locationIds.country;
    if (!isValidObjectId(state)) delete locationIds.state;
    if (!isValidObjectId(city)) delete locationIds.city;
    if (Array.isArray(locationIds.micro_location)) {
        locationIds.micro_location = locationIds.micro_location.filter((id) =>
            isValidObjectId(id),
        );
        if (!locationIds.micro_location.length) delete locationIds.micro_location;
    }
}

function stripInternalFields(body) {
    if (!body || typeof body !== 'object') return;
    delete body._id;
    delete body.__v;
}

/**
 * MongoDB 2dsphere requires Point + coordinates [lng, lat].
 * Drop `location` when coordinates are missing or invalid (avoids error 16755).
 */
function sanitizeLocationInPlace(payload) {
    if (!payload?.location || typeof payload.location !== 'object') {
        if (payload && 'location' in payload) delete payload.location;
        return;
    }
    const coords = payload.location.coordinates;
    const valid =
        Array.isArray(coords) &&
        coords.length === 2 &&
        Number.isFinite(Number(coords[0])) &&
        Number.isFinite(Number(coords[1]));
    if (!valid) {
        delete payload.location;
        return;
    }
    payload.location = {
        type: 'Point',
        coordinates: [Number(coords[0]), Number(coords[1])],
    };
}

/**
 * Frontend sometimes sends JS-literal snippets (single-quoted keys/values). Try last-resort sandbox parse.
 */
function tryParseOwnerJsLiteralArray(raw) {
    const s = String(raw).trim();
    if (!s.startsWith('[') || s.length > 8000) {
        throw new Error('invalid shape');
    }
    if (/constructor|prototype|__proto__|Function\b|import\b|require\b|eval\b/i.test(s)) {
        throw new Error('unsafe');
    }
    const value = vm.runInNewContext(`(${s})`, Object.create(null), { timeout: 100 });
    if (!Array.isArray(value)) throw new Error('not array');
    return value;
}

/**
 * Normalize `owner` from body: array | JSON string | JS-ish array literal string → plain array.
 */
function coerceOwnerArrayInput(owner) {
    if (owner === undefined) return undefined;
    if (owner === null || owner === '') return [];
    if (Array.isArray(owner)) return owner;
    if (typeof owner === 'string') {
        const s = owner.trim();
        if (!s) return [];
        try {
            const parsed = JSON.parse(s);
            if (!Array.isArray(parsed)) {
                throw httpError(400, 'owner must be a JSON array');
            }
            return parsed;
        } catch (e) {
            if (e?.name === 'cofynd') throw e;
        }
        try {
            return tryParseOwnerJsLiteralArray(s);
        } catch {
            /* continue */
        }
        try {
            const parsed = JSON.parse(s.replace(/'/g, '"'));
            if (!Array.isArray(parsed)) throw new Error();
            return parsed;
        } catch {
            throw httpError(
                400,
                'owner must be a JSON array of ObjectIds or objects with _id, userId, or name/email/phone',
            );
        }
    }
    throw httpError(400, 'owner must be an array or parseable string');
}

async function resolveOwnerEntryToObjectId(entry) {
    const PgOwnerModel = models.PgOwner;

    if (entry == null) {
        throw httpError(400, 'owner entries cannot be null');
    }

    if (typeof entry === 'string') {
        const t = entry.trim();
        if (!isValidObjectId(t)) {
            throw httpError(400, `Invalid owner id: ${t}`);
        }
        return new mongoose.Types.ObjectId(t);
    }

    if (entry instanceof mongoose.Types.ObjectId) {
        return entry;
    }

    if (typeof entry !== 'object') {
        throw httpError(400, 'invalid owner entry type');
    }

    if (isValidObjectId(entry._id)) {
        const id = String(entry._id);
        const found = await PgOwnerModel.findById(id).select('_id').lean();
        if (!found) {
            throw httpError(400, `PgOwner not found for _id ${id}`);
        }
        return new mongoose.Types.ObjectId(id);
    }

    if (isValidObjectId(entry.userId)) {
        const po = await PgOwnerModel.findOne({ userId: entry.userId }).select('_id').lean();
        if (!po) {
            throw httpError(
                400,
                'No PgOwner for given userId; send owner as { name, email, phone } to create/link one',
            );
        }
        return new mongoose.Types.ObjectId(po._id);
    }

    const name = entry.name != null ? String(entry.name).trim() : '';
    const email = entry.email != null ? String(entry.email).trim().toLowerCase() : '';
    const phone = entry.phone != null ? String(entry.phone).replace(/\s+/g, '').trim() : '';

    if (!email && !phone) {
        throw httpError(
            400,
            'owner object must include _id, userId, or at least email or phone',
        );
    }

    const or = [];
    if (email) or.push({ email });
    if (phone) or.push({ phone });

    let doc = await PgOwnerModel.findOne(or.length > 1 ? { $or: or } : or[0]);
    if (!doc) {
        doc = await PgOwnerModel.create({
            name: name || undefined,
            email: email || undefined,
            phone: phone || undefined,
            active: true,
            delete: false,
        });
        await ensureVendorUserForPgOwner(doc.toObject ? doc.toObject() : doc);
        return doc._id;
    }

    if (name) doc.name = name;
    if (email) doc.email = email;
    if (phone) doc.phone = phone;
    await doc.save();
    await ensureVendorUserForPgOwner(doc.toObject ? doc.toObject() : doc);
    return doc._id;
}

async function normalizeOwnersForSave(rawOwner) {
    let slots = coerceOwnerArrayInput(rawOwner);
    if (slots === undefined) return undefined;

    const expanded = [];
    for (const slot of slots) {
        if (
            typeof slot === 'string' &&
            slot.trim().startsWith('[') &&
            !isValidObjectId(slot.trim())
        ) {
            try {
                expanded.push(...coerceOwnerArrayInput(slot));
                continue;
            } catch {
                /* fall through: invalid id string */
            }
        }
        expanded.push(slot);
    }
    slots = expanded;

    const seen = new Set();
    const out = [];
    for (const slot of slots) {
        const oid = await resolveOwnerEntryToObjectId(slot);
        const key = String(oid);
        if (!seen.has(key)) {
            seen.add(key);
            out.push(oid);
        }
    }
    return out;
}

class ManagePgService {
    constructor() {
        return {
            getPgs: this.getPgs.bind(this),
            getPgById: this.getPgById.bind(this),
            createPg: this.createPg.bind(this),
            updatePg: this.updatePg.bind(this),
            deletePg: this.deletePg.bind(this),
            changePgStatus: this.changePgStatus.bind(this),
        };
    }

    /**
     * List PGs (admin). Query: limit, skip, name, locality, city (ObjectId string), status,
     * active, userId, includeDeleted (1 = show soft-deleted)
     */
    async getPgs(query) {
        const {
            limit = 20,
            skip = 0,
            sortBy = 'added_on',
            orderBy = '-1',
            name,
            locality,
            city,
            status,
            active,
            userId,
            adminApproved,
            includeDeleted,
        } = query;

        const condition = {};
        if (!includeDeleted || includeDeleted === '0') {
            condition.delete = { $ne: true };
        }
        if (name) {
            const safe = String(name).replace(/[^A-Za-z0-9 ]/g, '');
            if (safe.length) {
                condition.name = { $regex: safe, $options: 'i' };
            }
        }
        if (locality) {
            condition.locality = { $regex: String(locality), $options: 'i' };
        }
        if (city && isValidObjectId(city)) {
            condition['locationIds.city'] = city;
        }
        if (status != null && status !== '') {
            condition.status = status;
        }
        if (active === 'true' || active === true) {
            condition.active = true;
        }
        if (active === 'false' || active === false) {
            condition.active = false;
        }
        if (userId && isValidObjectId(userId)) {
            condition.userId = userId;
        }
        if (adminApproved === 'true' || adminApproved === true) {
            condition.adminApproved = true;
        }
        if (adminApproved === 'false' || adminApproved === false) {
            condition.adminApproved = false;
        }

        const sort = { [sortBy]: Number(orderBy) === 1 ? 1 : -1 };
        const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
        const sk = Math.max(Number(skip) || 0, 0);

        const [items, count] = await Promise.all([
            PG.find(condition)
                .populate('images.image')
                .populate('userId')
                .populate('locationIds.country')
                .populate('locationIds.state')
                .populate('locationIds.city')
                .populate('locationIds.micro_location')
                .sort(sort)
                .skip(sk)
                .limit(lim)
                .lean(),
            PG.countDocuments(condition),
        ]);

        await attachPgOwnerDetails(items);

        return { pgs: items, count };
    }

    async getPgById({ pgId }) {
        if (!pgId || !isValidObjectId(pgId)) {
            throw httpError(400, 'Invalid pgId');
        }
        const doc = await PG.findById(pgId)
            .populate('images.image')
            .populate('userId')
            .populate('locationIds.country')
            .populate('locationIds.state')
            .populate('locationIds.city')
            .populate('locationIds.micro_location')
            .lean();

        if (!doc) {
            throw httpError(404, 'PG not found');
        }
        await attachPgOwnerDetails(doc);
        return doc;
    }

    async createPg(body) {
        const payload = typeof body === 'object' && body ? { ...body } : {};
        stripInternalFields(payload);
        if (!payload.name || !String(payload.name).trim()) {
            throw httpError(400, 'name is required');
        }
        if (payload.locationIds) {
            sanitizeLocationIdsInPlace(payload.locationIds);
            if (Object.keys(payload.locationIds).length === 0) {
                delete payload.locationIds;
            }
        }
        sanitizeLocationInPlace(payload);
        payload.delete = false;

        if (Object.prototype.hasOwnProperty.call(payload, 'owner')) {
            payload.owner = await normalizeOwnersForSave(payload.owner);
        }
        const ownerUserId = await resolveUserIdForPgFields({
            owner: payload.owner,
            userId: payload.userId,
            contactNumber: payload.contactNumber,
            contactEmail: payload.contactEmail,
        });
        if (ownerUserId) payload.userId = ownerUserId;

        if (!payload.pg_id || !String(payload.pg_id).trim()) {
            payload.pg_id = await allocateNextPgId(PG, {
                city: payload.city,
                name: payload.name,
            });
        }
        payload.status = payload.status || 'inprogress';
        payload.adminApproved = false;

        const customSlug = payload.slug && String(payload.slug).trim()
            ? slugifyText(payload.slug)
            : null;
        payload.slug = await allocateUniquePgSlug(
            PG,
            {
                name: payload.name,
                locality: payload.locality,
                city: payload.city,
            },
            { baseSlug: customSlug || undefined },
        );

        const created = await PG.create(payload);
        const createdDoc = await PG.findById(created._id)
            .populate('images.image')
            .populate('userId')
            .populate('locationIds.city')
            .lean();
        await attachPgOwnerDetails(createdDoc);
        return createdDoc;
    }

    async updatePg(paramsAndBody) {
        const { id, ...rest } = paramsAndBody || {};
        if (!id || !isValidObjectId(id)) {
            throw httpError(400, 'Invalid id');
        }
        stripInternalFields(rest);
        const existing = await PG.findById(id);
        if (!existing) {
            throw httpError(404, 'PG not found');
        }
        if (rest.locationIds) {
            sanitizeLocationIdsInPlace(rest.locationIds);
        }
        if (Object.prototype.hasOwnProperty.call(rest, 'location')) {
            sanitizeLocationInPlace(rest);
        }

        if (Object.prototype.hasOwnProperty.call(rest, 'owner')) {
            rest.owner = await normalizeOwnersForSave(rest.owner);
        }
        const ownerUserId = await resolveUserIdForPgFields({
            owner: rest.owner ?? existing.owner,
            userId: rest.userId ?? existing.userId,
            contactNumber: rest.contactNumber ?? existing.contactNumber,
            contactEmail: rest.contactEmail ?? existing.contactEmail,
        });
        if (ownerUserId) rest.userId = ownerUserId;

        const slugFieldsChanged =
            Object.prototype.hasOwnProperty.call(rest, 'name') ||
            Object.prototype.hasOwnProperty.call(rest, 'locality') ||
            Object.prototype.hasOwnProperty.call(rest, 'city');

        if (rest.slug && String(rest.slug).trim()) {
            rest.slug = await allocateUniquePgSlug(
                PG,
                {
                    name: rest.name ?? existing.name,
                    locality: rest.locality ?? existing.locality,
                    city: rest.city ?? existing.city,
                },
                {
                    excludeId: existing._id,
                    baseSlug: slugifyText(rest.slug),
                },
            );
        } else if (slugFieldsChanged || !existing.slug) {
            rest.slug = await allocateUniquePgSlug(
                PG,
                {
                    name: rest.name ?? existing.name,
                    locality: rest.locality ?? existing.locality,
                    city: rest.city ?? existing.city,
                },
                { excludeId: existing._id },
            );
        }

        Object.assign(existing, rest);
        if (existing.locationIds) sanitizeLocationIdsInPlace(existing.locationIds);
        await existing.save();

        const updatedDoc = await PG.findById(id)
            .populate('images.image')
            .populate('userId')
            .populate('locationIds.country')
            .populate('locationIds.state')
            .populate('locationIds.city')
            .populate('locationIds.micro_location')
            .lean();
        await attachPgOwnerDetails(updatedDoc);
        return updatedDoc;
    }

    /** Soft-delete: marks `delete: true`, `active: false` */
    async deletePg({ id }) {
        if (!id || !isValidObjectId(id)) {
            throw httpError(400, 'Invalid id');
        }
        const doc = await PG.findByIdAndUpdate(
            id,
            { $set: { delete: true, active: false } },
            { new: true },
        ).lean();
        if (!doc) {
            throw httpError(404, 'PG not found');
        }
        return doc;
    }

    async changePgStatus({ pgId, status, adminApproved, verified, active }) {
        if (!pgId || !isValidObjectId(pgId)) {
            throw httpError(400, 'Invalid pgId');
        }
        const $set = {};
        if (status != null && status !== '') $set.status = status;
        if (adminApproved !== undefined) {
            $set.adminApproved = adminApproved === true || adminApproved === 'true';
        }
        if (verified !== undefined) {
            $set.verified = verified === true || verified === 'true';
        }
        if (active !== undefined) {
            $set.active = active === true || active === 'true';
        }
        if ($set.adminApproved === true) {
            $set.adminApprovalDate = new Date();
        }
        if (Object.keys($set).length === 0) {
            throw httpError(400, 'Provide status, adminApproved, verified, or active');
        }
        const doc = await PG.findByIdAndUpdate(pgId, { $set }, { new: true }).lean();
        if (!doc) {
            throw httpError(404, 'PG not found');
        }
        return doc;
    }
}

export default new ManagePgService();
