import { ApiError } from '../../utils/apiError.js';
import models from '../../../models/index.js';
import {
    POPULATE,
    WorkSpace,
    freshOfDays,
    listingById,
    statusCounts,
    toCrmListing,
    workspaceQuery,
} from './workspace-listings.js';
import { createWorkspace, saveImageTitles, updateWorkspace } from './workspace-editor.js';
import { MO_POPULATE, ManagedOffice, managedOfficeQuery, managedOfficeStatusCounts, toCrmManagedOffice } from './managed-office-listings.js';
import { createManagedOffice, updateManagedOffice } from './managed-office-editor.js';
import { PG, PG_POPULATE, pgQuery, pgStatusCounts, toCrmPg } from './pg-listings.js';
import { createPgFromCrm, updatePgFromCrm } from './pg-editor.js';

export { freshOfDays };

const EMPTY_PAGE = { items: [], total: 0, page: 1, limit: 20, pageCount: 1 };
const MO_SORTS = {
    updated: { updated_on: -1, _id: -1 },
    newest: { added_on: -1, _id: -1 },
    price: { 'plans.price': 1, _id: 1 },
    seats: { no_of_seats: -1, _id: -1 },
    name: { name: 1, _id: 1 },
};
const PG_SORTS = {
    updated: { updated_on: -1, _id: -1 },
    newest: { added_on: -1, _id: -1 },
    price: { minMonthlyRent: 1, _id: 1 },
    seats: { updated_on: -1, _id: -1 },
    name: { name: 1, _id: 1 },
};
const SORTS = {
    updated: { updated_on: -1, _id: -1 },
    newest: { added_on: -1, _id: -1 },
    price: { starting_price: 1, _id: 1 },
    seats: { no_of_seats: -1, _id: -1 },
    name: { name: 1, _id: 1 },
};

/**
 * Inventory list = the website's coworking spaces, with their approval status.
 * Without page/limit it returns every match (Smart Match uses that, approved spaces only).
 */
export async function listListings(filters, options = {}) {
    const mo = filters.vertical === 'managed-office';
    const pg = filters.vertical === 'coliving';
    const Model = pg ? PG : mo ? ManagedOffice : WorkSpace;
    const q = pg ? pgQuery(filters, options.search)
        : mo ? await managedOfficeQuery(filters, options.search) : await workspaceQuery(filters, options.search);
    const counts = () => (pg ? pgStatusCounts(filters, options.search)
        : mo ? managedOfficeStatusCounts(filters, options.search) : statusCounts(filters, options.search));
    const map = pg ? toCrmPg : mo ? toCrmManagedOffice : toCrmListing;
    const populate = pg ? PG_POPULATE : mo ? MO_POPULATE : POPULATE;
    const paginate = options.page !== undefined || options.limit !== undefined;
    const page = Math.max(1, options.page ?? 1);
    const limit = paginate ? Math.min(100, Math.max(1, options.limit ?? 20)) : undefined;
    const withCounts = options.withCounts && paginate;

    if (!q) {
        return { ...EMPTY_PAGE, limit: limit ?? 20, ...(withCounts ? { statusCounts: await counts() } : {}) };
    }

    const sorts = pg ? PG_SORTS : mo ? MO_SORTS : SORTS;
    const sort = sorts[options.sort] || sorts.updated;
    let rows;
    let total;
    if (paginate) {
        [rows, total] = await Promise.all([
            Model.find(q).sort(sort).skip((page - 1) * limit).limit(limit).populate(populate).lean(),
            Model.countDocuments(q),
        ]);
    } else {
        rows = await Model.find(q).sort(sort).populate(populate).lean();
        total = rows.length;
    }

    return {
        items: rows.map(map),
        total,
        page: paginate ? page : 1,
        limit: paginate ? limit : total,
        pageCount: paginate ? Math.max(1, Math.ceil(total / limit)) : 1,
        ...(withCounts ? { statusCounts: await counts() } : {}),
    };
}

export async function getListing(id) {
    return listingById(id);
}

const MANAGED = 'Spaces are deleted in the admin panel.';

/** New coworking space from the CRM apps (saved as a website WorkSpace, Pending unless an admin approves). */
export async function createListing(body, user) {
    const id = body.vertical === 'coliving' ? await createPgFromCrm(body, user)
        : body.vertical === 'managed-office' ? await createManagedOffice(body, user) : await createWorkspace(body, user);
    await saveImageTitles(body.photos);
    return listingById(id);
}

export async function updateListing(id, body, user) {
    const [isMo, isPg] = await Promise.all([ManagedOffice.exists({ _id: id }), PG.exists({ _id: id })]);
    const saved = isPg ? await updatePgFromCrm(id, body, user)
        : isMo ? await updateManagedOffice(id, body, user) : await updateWorkspace(id, body, user);
    if (!saved) return null;
    await saveImageTitles(body.photos);
    return listingById(id);
}

export async function deleteListing() {
    throw new ApiError(400, MANAGED, 'MANAGED_IN_ADMIN');
}

/** "Mark verified": staff confirmed availability and prices today. Only touches the CRM fields. */
export async function verifyListing(id, userId) {
    const $set = { crm_verified_at: new Date(), ...(userId ? { crm_verified_by: userId } : {}) };
    let res = await WorkSpace.updateOne({ _id: id }, { $set }, { timestamps: false });
    if (!res.matchedCount) res = await ManagedOffice.updateOne({ _id: id }, { $set }, { timestamps: false });
    if (!res.matchedCount) res = await PG.updateOne({ _id: id }, { $set }, { timestamps: false });
    if (!res.matchedCount) return null;
    return listingById(id);
}

const VERIFY_METHODS = ['call', 'visit', 'documents'];

/**
 * Website "Verified on <date>" badge for a coworking space or PG (same as the admin panel's
 * Verification box): today's date, who, and how. PGs keep `verified` in step for the website filter.
 */
export async function setWebsiteVerification(id, body, user) {
    const remove = body?.remove === true;
    const method = String(body?.method || '');
    if (!remove && !VERIFY_METHODS.includes(method)) {
        throw new ApiError(400, `method must be one of: ${VERIFY_METHODS.join(', ')}`, 'BAD_METHOD');
    }
    const isPg = await PG.exists({ _id: id });
    const Model = isPg ? PG : WorkSpace;
    if (!isPg && !(await WorkSpace.exists({ _id: id }))) return null;
    const by = String(user?.name || user?.email || 'CRM').slice(0, 120);
    const update = remove
        ? { $unset: { verified_at: '', verified_by: '', verified_method: '' }, ...(isPg ? { $set: { verified: false } } : {}) }
        : { $set: { verified_at: new Date(), verified_by: by, verified_method: method, ...(isPg ? { verified: true } : {}) } };
    const d = await Model.findByIdAndUpdate(id, update, { new: true }).select('verified_at verified_by verified_method').lean();
    return { at: d?.verified_at || null, by: d?.verified_by || '', method: d?.verified_method || '' };
}

let metaCache = null;
/** Amenity names actually used on spaces (most used first) and the plan types, for the filters. */
export async function listingsMeta() {
    if (metaCache && metaCache.at > Date.now() - 10 * 60e3) return metaCache.data;
    const rows = await WorkSpace.aggregate([
        { $unwind: '$amenties' },
        { $group: { _id: '$amenties', n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 30 },
    ]);
    const names = await models.Amenty.find({ _id: { $in: rows.map((r) => r._id) } }).select('name').lean();
    const byId = new Map(names.map((a) => [String(a._id), a.name]));
    const data = {
        amenities: rows.map((r) => byId.get(String(r._id))).filter(Boolean),
        spaceTypes: ['Hot desk', 'Dedicated desk', 'Private cabin', 'Managed office', 'Day pass', 'Virtual office', 'Meeting room'],
        statuses: [
            { key: 'approved', label: 'Approved' },
            { key: 'pending', label: 'Pending' },
            { key: 'inprogress', label: 'In progress' },
            { key: 'rejected', label: 'Rejected' },
        ],
    };
    metaCache = { at: Date.now(), data };
    return data;
}
