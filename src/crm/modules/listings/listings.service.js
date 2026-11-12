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

export { freshOfDays };

const EMPTY_PAGE = { items: [], total: 0, page: 1, limit: 20, pageCount: 1 };
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
    const q = await workspaceQuery(filters, options.search);
    const paginate = options.page !== undefined || options.limit !== undefined;
    const page = Math.max(1, options.page ?? 1);
    const limit = paginate ? Math.min(100, Math.max(1, options.limit ?? 20)) : undefined;
    const withCounts = options.withCounts && paginate;

    if (!q) {
        return { ...EMPTY_PAGE, limit: limit ?? 20, ...(withCounts ? { statusCounts: await statusCounts(filters, options.search) } : {}) };
    }

    const sort = SORTS[options.sort] || SORTS.updated;
    let rows;
    let total;
    if (paginate) {
        [rows, total] = await Promise.all([
            WorkSpace.find(q).sort(sort).skip((page - 1) * limit).limit(limit).populate(POPULATE).lean(),
            WorkSpace.countDocuments(q),
        ]);
    } else {
        rows = await WorkSpace.find(q).sort(sort).populate(POPULATE).lean();
        total = rows.length;
    }

    return {
        items: rows.map(toCrmListing),
        total,
        page: paginate ? page : 1,
        limit: paginate ? limit : total,
        pageCount: paginate ? Math.max(1, Math.ceil(total / limit)) : 1,
        ...(withCounts ? { statusCounts: await statusCounts(filters, options.search) } : {}),
    };
}

export async function getListing(id) {
    return listingById(id);
}

const MANAGED = 'Coworking spaces are deleted in the admin panel.';

/** New coworking space from the CRM apps (saved as a website WorkSpace, Pending unless an admin approves). */
export async function createListing(body, user) {
    const id = await createWorkspace(body, user);
    await saveImageTitles(body.photos);
    return listingById(id);
}

export async function updateListing(id, body, user) {
    const saved = await updateWorkspace(id, body, user);
    if (!saved) return null;
    await saveImageTitles(body.photos);
    return listingById(id);
}

export async function deleteListing() {
    throw new ApiError(400, MANAGED, 'MANAGED_IN_ADMIN');
}

/** "Mark verified": staff confirmed availability and prices today. Only touches the CRM fields. */
export async function verifyListing(id, userId) {
    const res = await WorkSpace.updateOne(
        { _id: id },
        { $set: { crm_verified_at: new Date(), ...(userId ? { crm_verified_by: userId } : {}) } },
        { timestamps: false },
    );
    if (!res.matchedCount) return null;
    return listingById(id);
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
