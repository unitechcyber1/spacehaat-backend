import models from '../../../models/index.js';
import { searchClauses } from './listing-search.js';
import {
    ADMIN_URL, LISTING_STATUSES, SITE_URL, STATUS_FROM_KEY,
    cityIds, daysSince, escape, freshOfDays, freshnessRange, hours, inCityScope, stripHtml,
} from './workspace-listings.js';

/**
 * Managed offices (the website's `/managed-office` vertical, `ManagedOffice` collection) in the CRM listing
 * shape, so they show in Inventory, go into proposals / PDFs / client portal like coworking spaces.
 */
const { ManagedOffice, Amenty } = models;

export const SEAT_TYPES = {
    ready_to_move_in: 'Ready to move in',
    warm_shell: 'Warm shell',
    bare_shell: 'Bare shell',
};

export const MO_POPULATE = [
    { path: 'images.image', select: 's3_link' },
    { path: 'amenties', select: 'name' },
    { path: 'plans.category', select: 'name' },
    { path: 'location.city', select: 'name' },
    { path: 'location.micro_location', select: 'name' },
    { path: 'brand', select: 'name' },
];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function toCrmManagedOffice(d) {
    const loc = d.location || {};
    const id = String(d._id);
    const visible = (d.plans || []).filter((p) => p && p.should_show !== false);

    const planRows = visible.map((p) => {
        const seat = SEAT_TYPES[p.seat_type] || '';
        return {
            label: seat ? `${seat} seat` : p.category?.name || 'Office seat',
            type: 'Managed office',
            seatType: seat,
            price: num(p.price),
            unit: p.duration || 'month',
            seats: p.number_of_items || 1,
            onRequest: !(num(p.price) > 0),
        };
    }).sort((a, b) => (a.onRequest - b.onRequest) || a.price - b.price);

    const prices = planRows.filter((p) => !p.onRequest && p.unit === 'month').map((p) => p.price);
    const price = prices.length ? Math.min(...prices) : 0;
    const seatTypes = [...new Set(planRows.map((p) => p.seatType).filter(Boolean))];

    const images = [...(d.images || [])].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
        .map((i) => i?.image?.s3_link).filter(Boolean);
    const amenities = (d.amenties || []).map((a) => a?.name).filter(Boolean);
    const h = hours(d.hours_of_operation);
    const status = LISTING_STATUSES[d.status] || LISTING_STATUSES.pending;
    const verifiedAt = d.crm_verified_at || null;
    const seen = verifiedAt || d.updated_on || d.added_on;
    const lat = Number(loc.latitude);
    const lng = Number(loc.longitude);
    const hasPoint = Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng);
    const address = [loc.building_name, loc.floor, loc.address1, loc.postal_code].filter(Boolean).join(', ');
    const b = d.building || {};
    const seats = num(d.no_of_seats) || num(b.total_seats);

    return {
        _id: id,
        id,
        source: 'managed-office',
        vertical: 'managed-office',
        name: d.name,
        operator: d.name,
        brand: d.brand?.name || '',
        city: loc.city?.name || '',
        micro: loc.micro_location?.name || loc.micro_location_string || loc.name || '',
        type: 'Managed office',
        spaceTypes: ['Managed office'],
        seats,
        price,
        amenities,
        images,
        photoMeta: [],
        tier: '',
        avail: '',
        status,
        isActive: d.is_active !== false,
        addedBy: d.added_by_user || 'admin',
        description: stripHtml(d.new_description || d.description),
        plans: planRows,
        hours: h.rows,
        office: {
            seatTypes,
            centreType: d.centre_type === 'coworking' ? 'Coworking centre' : 'Managed office',
            isNewLaunch: Boolean(d.is_new_launch),
            superArea: num(b.super_area),
            totalFloors: num(b.total_floors),
            totalSeats: num(b.total_seats),
            floors: (b.floors || []).map((f) => ({ floor: f.floor_number ?? '', area: num(f.area), seats: num(f.seats) })),
            minSeats: num(d.lease_terms?.min_seats),
            minMonths: num(d.lease_terms?.min_duration_months),
            rating: num(d.rating?.average) ? { average: num(d.rating.average), total: num(d.rating.total), source: d.rating.source || '' } : null,
        },
        url: d.status === 'approve' && d.slug ? `${SITE_URL}/managed-office/${d.slug}` : '',
        adminUrl: `${ADMIN_URL}/layout/managed-office/detail/${id}`,
        verifiedAt,
        updatedAt: d.updated_on || d.added_on || d._id.getTimestamp(),
        createdAt: d.added_on || d._id.getTimestamp(),
        fresh: seen ? freshOfDays(daysSince(seen)) : { state: 'expired', label: 'Never verified', days: 999 },
        profile: {
            identity: {
                centreName: d.name,
                address,
                mapsLink: hasPoint ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
                    : address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.name}, ${address}`)}` : '',
                nearestMetro: loc.is_near_metro ? [loc.metro_stop_landmark, loc.metro_stop_distance].filter(Boolean).join(' · ') : '',
                landmark: [loc.landmark, loc.landmark_distance].filter(Boolean).join(' · '),
                floors: loc.floor || '',
                carpet: num(b.super_area),
            },
            capacity: { totalSeats: seats },
            pricing: price ? { managedOffice: price } : {},
            operations: {
                timings: h.timings,
                daysOpen: h.daysOpen,
                sundayVisits: Boolean(h.sundayOpen),
                virtualOfficeAvailable: false,
                managedOfficeAvailable: true,
            },
            contactsMedia: {
                centerManager: { name: '', phone: '' },
                communityManager: { name: '', phone: '' },
                salesPhone: '',
                salesEmail: '',
                extraAmenities: amenities,
                gallery: images,
                website: '',
                instagram: '',
            },
        },
    };
}

/** CRM filters → a ManagedOffice query (null = can't match). */
export async function managedOfficeQuery(filters = {}, search = '') {
    const and = [];
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
        const ids = await cityIds(cityNames);
        if (!ids.length) return null;
        and.push({ 'location.city': { $in: ids } });
    }

    if (filters.status && filters.status !== 'all') {
        const s = String(filters.status).split(',').map((k) => STATUS_FROM_KEY[k] || k).filter((k) => LISTING_STATUSES[k]);
        if (s.length) and.push(s.includes('pending') ? { $or: [{ status: { $in: s } }, { status: { $exists: false } }] } : { status: { $in: s } });
    }
    if (filters.liveOnly) and.push({ status: 'approve', is_active: { $ne: false } });

    const seatKey = Object.keys(SEAT_TYPES).find((k) => k === filters.seatType || SEAT_TYPES[k] === filters.seatType);
    if (seatKey) and.push({ 'plans.seat_type': seatKey });
    if (typeof filters.maxPrice === 'number') {
        and.push({ plans: { $elemMatch: { price: { $gt: 0, $lte: filters.maxPrice }, should_show: { $ne: false } } } });
    }
    if (typeof filters.minSeats === 'number' && filters.minSeats > 0) {
        and.push({ $or: [{ no_of_seats: { $gte: filters.minSeats } }, { 'building.total_seats': { $gte: filters.minSeats } }] });
    }
    if (filters.amenities?.length) {
        const rows = await Amenty.find({ name: { $in: filters.amenities.map((a) => new RegExp(`^${escape(a)}$`, 'i')) } }).select('_id').lean();
        if (rows.length < filters.amenities.length) return null;
        and.push({ amenties: { $all: rows.map((r) => r._id) } });
    }
    if (filters.freshness) {
        const range = freshnessRange(filters.freshness);
        const or = [{ crm_verified_at: range }, { crm_verified_at: null, updated_on: range }, { crm_verified_at: null, updated_on: null, added_on: range }];
        if (filters.freshness === 'expired') or.push({ crm_verified_at: null, updated_on: null, added_on: null });
        and.push({ $or: or });
    }

    and.push(...(await searchClauses(search, {
        text: ['name', 'slug', 'location.building_name', 'location.address1', 'location.micro_location_string',
            'location.name', 'location.landmark', 'location.metro_stop_landmark'],
        city: 'location.city',
        micro: 'location.micro_location',
        brand: 'brand',
    })));
    return and.length ? { $and: and } : {};
}

export async function managedOfficeStatusCounts(filters, search) {
    const out = { all: 0, approved: 0, pending: 0, inprogress: 0, rejected: 0 };
    const q = await managedOfficeQuery({ ...filters, status: undefined }, search);
    if (!q) return out;
    const rows = await ManagedOffice.aggregate([{ $match: q }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
    for (const r of rows) {
        out[(LISTING_STATUSES[r._id] || LISTING_STATUSES.pending).key] += r.n;
        out.all += r.n;
    }
    return out;
}

export { ManagedOffice };
