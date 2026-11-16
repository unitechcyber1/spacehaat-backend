import models from '../../../models/index.js';
import { pgIndexInGoogle } from '../../../utilities/pg-response-formatter.js';
import { ADMIN_URL, SITE_URL, daysSince, escape, freshOfDays, freshnessRange, inCityScope, stripHtml } from './workspace-listings.js';

/**
 * PGs / coliving (the website's `/coliving` vertical, `PG` collection) in the CRM listing shape, so they
 * show in the apps' Inventory next to coworking spaces and managed offices.
 */
const { PG } = models;

/** PG.status → what staff see (PGs have no separate "pending": new ones start as In progress). */
export const PG_STATUSES = {
    approve: { key: 'approved', label: 'Approved' },
    inprogress: { key: 'inprogress', label: 'In progress' },
    reject: { key: 'rejected', label: 'Rejected' },
};
export const PG_STATUS_FROM_KEY = { approved: 'approve', inprogress: 'inprogress', pending: 'inprogress', rejected: 'reject' };

export const PG_POPULATE = [{ path: 'images.image', select: 's3_link' }];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** City names the CRM uses ↔ how PGs store them (PGs keep the city as text, e.g. "Gurugram"). */
const CITY_NAMES = {
    gurugram: ['Gurugram', 'Gurgaon'],
    gurgaon: ['Gurugram', 'Gurgaon'],
    bangalore: ['Bengaluru', 'Bangalore'],
    bengaluru: ['Bengaluru', 'Bangalore'],
    delhi: ['Delhi', 'New Delhi'],
    'new delhi': ['New Delhi', 'Delhi'],
};
const cityVariants = (n) => CITY_NAMES[String(n || '').toLowerCase().trim()] || [String(n || '').trim()];

export function toCrmPg(d) {
    const id = String(d._id);
    const rooms = (d.pgRooms || []).map((r) => ({ type: r.roomType || 'Room', rent: num(r.monthlyRent), deposit: num(r.expectedDeposit) }));
    const rents = rooms.map((r) => r.rent).filter((r) => r > 0);
    const price = rents.length ? Math.min(...rents) : num(d.minMonthlyRent);
    const images = [...(d.images || [])].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
        .map((i) => i?.image?.s3_link).filter(Boolean);
    const amenities = [...(d.availableAmenities || []), ...(d.roomAmenities || [])];
    const status = PG_STATUSES[d.status] || PG_STATUSES.inprogress;
    const verifiedAt = d.crm_verified_at || null;
    const seen = verifiedAt || d.updated_on || d.added_on;
    const lng = num(d.location?.coordinates?.[0]);
    const lat = num(d.location?.coordinates?.[1]);
    const address = [d.street, d.address || d.locationIds?.address].filter(Boolean).join(', ');

    return {
        _id: id,
        id,
        source: 'pg',
        vertical: 'coliving',
        name: d.name,
        operator: d.name,
        brand: '',
        city: d.city || '',
        micro: d.locality || '',
        type: d.availableFor || 'PG',
        spaceTypes: [...new Set(rooms.map((r) => r.type))],
        seats: 0,
        price,
        amenities,
        images,
        photoMeta: [],
        tier: '',
        avail: '',
        status,
        isActive: d.active !== false,
        addedBy: d.postBy || '',
        description: stripHtml(d.new_description || d.description),
        plans: rooms.map((r) => ({ label: r.type, type: r.type, price: r.rent, unit: 'month', seats: 1, onRequest: !(r.rent > 0), deposit: r.deposit })),
        hours: [],
        pg: {
            gender: d.availableFor || '',
            guests: d.preferredGuest || '',
            postedBy: d.postBy || '',
            food: d.foodIncluded ? (d.includedMeals || []).join(', ') || 'Included' : 'Not included',
            noticeDays: d.noticePeriod ? num(d.noticePeriodDuration) : 0,
            laundry: d.isLaundryService ? d.laundryService?.days || 'Yes' : '',
            rules: d.pgHostelRule || [],
            commonAmenities: d.availableAmenities || [],
            roomAmenities: d.roomAmenities || [],
            rating: num(d.rating),
            websiteVerifiedAt: d.verified_at || null,
            inGoogle: pgIndexInGoogle(d),
            contactPhone: d.contactNumber || '',
        },
        url: d.status === 'approve' && d.active !== false && d.slug ? `${SITE_URL}/coliving/${d.slug}` : '',
        adminUrl: `${ADMIN_URL}/layout/pg/${id}/edit`,
        verifiedAt,
        updatedAt: d.updated_on || d.added_on || d._id.getTimestamp(),
        createdAt: d.added_on || d._id.getTimestamp(),
        fresh: seen ? freshOfDays(daysSince(seen)) : { state: 'expired', label: 'Never verified', days: 999 },
        profile: {
            identity: {
                centreName: d.name,
                address,
                mapsLink: lat || lng ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
                    : address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.name}, ${address}`)}` : '',
                nearestMetro: '',
                landmark: '',
                floors: '',
            },
            capacity: { totalSeats: 0 },
            pricing: {},
            operations: { timings: '', daysOpen: '', sundayVisits: false, virtualOfficeAvailable: false, managedOfficeAvailable: false },
            contactsMedia: {
                centerManager: { name: '', phone: '' },
                communityManager: { name: '', phone: '' },
                salesPhone: d.contactNumber || '',
                salesEmail: d.contactEmail || '',
                extraAmenities: amenities,
                gallery: images,
                website: '',
                instagram: '',
            },
        },
    };
}

/** CRM filters → a PG query (null = can't match). Deleted PGs never show. */
export function pgQuery(filters = {}, search = '') {
    const and = [{ delete: { $ne: true } }];

    const allowed = filters.allowedCities;
    let cityNames = null;
    if (Array.isArray(allowed)) {
        if (!allowed.length) return null;
        if (filters.city && filters.city !== 'All cities') {
            if (!inCityScope(allowed, filters.city)) return null;
            cityNames = [filters.city];
        } else cityNames = allowed;
    } else if (filters.city && filters.city !== 'All cities') cityNames = [filters.city];
    if (cityNames) {
        const names = [...new Set(cityNames.flatMap(cityVariants))];
        and.push({ city: { $in: names.map((n) => new RegExp(`^${escape(n)}$`, 'i')) } });
    }

    if (filters.status && filters.status !== 'all') {
        const s = String(filters.status).split(',').map((k) => PG_STATUS_FROM_KEY[k] || k).filter((k) => PG_STATUSES[k]);
        if (s.length) and.push({ status: { $in: s } });
    }
    if (filters.liveOnly) and.push({ status: 'approve', active: { $ne: false } });
    if (filters.gender && filters.gender !== 'All') and.push({ availableFor: new RegExp(`^${escape(filters.gender)}$`, 'i') });
    if (typeof filters.maxPrice === 'number') and.push({ 'pgRooms.monthlyRent': { $gt: 0, $lte: filters.maxPrice } });
    if (filters.food) and.push({ foodIncluded: true });
    if (filters.freshness) {
        const range = freshnessRange(filters.freshness);
        const or = [{ crm_verified_at: range }, { crm_verified_at: null, updated_on: range }, { crm_verified_at: null, updated_on: null, added_on: range }];
        if (filters.freshness === 'expired') or.push({ crm_verified_at: null, updated_on: null, added_on: null });
        and.push({ $or: or });
    }

    const tokens = String(search || '').trim().split(/\s+/).filter(Boolean).slice(0, 6);
    for (const token of tokens) {
        const re = new RegExp(escape(token), 'i');
        and.push({ $or: [{ name: re }, { locality: re }, { address: re }, { slug: re }, { pg_id: re }] });
    }
    return { $and: and };
}

export async function pgStatusCounts(filters, search) {
    const out = { all: 0, approved: 0, pending: 0, inprogress: 0, rejected: 0 };
    const q = pgQuery({ ...filters, status: undefined }, search);
    if (!q) return out;
    const rows = await PG.aggregate([{ $match: q }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
    for (const r of rows) {
        out[(PG_STATUSES[r._id] || PG_STATUSES.inprogress).key] += r.n;
        out.all += r.n;
    }
    return out;
}

export { PG };
