import models from '../../../models/index.js';
import { searchClauses } from './listing-search.js';
import {
    ADMIN_URL, LISTING_STATUSES, STATUS_FROM_KEY,
    cityIds, daysSince, escape, freshOfDays, freshnessRange, inCityScope, stripHtml,
} from './workspace-listings.js';

/**
 * Private offices: offices for lease (the `OfficeSpace` collection the admin panel's "Private offices" pages
 * manage: area, rent per sq ft, furnishing, maintenance, deposit). Shown in the CRM listing shape so they appear
 * in Inventory and go into proposals like the other sections. They are not on the public website yet.
 */
const { OfficeSpace, Amenty } = models;

/** OfficeSpace.other_detail.office_type → label. */
export const OFFICE_TYPES = {
    'fully-furnished': 'Fully furnished',
    'semi-furnished': 'Semi furnished',
    raw: 'Bare shell',
    'build-to-suite': 'Built to suit',
};

export const PO_POPULATE = [
    { path: 'images.image', select: 's3_link' },
    { path: 'amenties', select: 'name' },
    { path: 'location.city', select: 'name' },
    { path: 'location.micro_location', select: 'name' },
    { path: 'builder', select: 'name' },
];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** "workstations: 20" style facility rows → the number of workstations, if given. */
function workstationsOf(facilities = []) {
    const row = facilities.find((f) => /work\s*station|seat/i.test(f?.name || ''));
    return num(String(row?.value || '').replace(/[^\d]/g, ''));
}

export function toCrmPrivateOffice(d) {
    const loc = d.location || {};
    const o = d.other_detail || {};
    const id = String(d._id);
    const micros = (Array.isArray(loc.micro_location) ? loc.micro_location : [loc.micro_location]).filter(Boolean);
    const micro = micros[0]?.name || loc.micro_location_string || loc.name || '';
    const rent = num(o.monthly_rent) || (num(o.rent_in_sq_ft) * num(o.area_for_lease_in_sq_ft));
    const seats = workstationsOf(o.facilities);
    const officeType = OFFICE_TYPES[o.office_type] || '';
    const facilities = (o.facilities || [])
        .filter((f) => f && String(f.name || '').trim())
        .map((f) => ({ name: String(f.name).trim(), value: String(f.value ?? '').trim() }));
    const images = [...(d.images || [])].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
        .map((i) => i?.image?.s3_link).filter(Boolean);
    const amenities = (d.amenties || []).map((a) => a?.name).filter(Boolean);
    const status = LISTING_STATUSES[d.status] || LISTING_STATUSES.pending;
    const verifiedAt = d.crm_verified_at || null;
    const seen = verifiedAt || d.updated_on || d.added_on;
    const lat = Number(loc.latitude);
    const lng = Number(loc.longitude);
    const hasPoint = Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng);
    const buildingName = o.building_name || loc.name || '';
    const address = [buildingName, loc.floor || o.floor, loc.address, loc.postal_code].filter(Boolean).join(', ');
    const metro = loc.metro_detail?.is_near_metro
        ? [loc.metro_detail.name, num(loc.metro_detail.distance) ? `${num(loc.metro_detail.distance)} km` : ''].filter(Boolean).join(' · ')
        : '';

    return {
        _id: id,
        id,
        source: 'private-office',
        vertical: 'private-office',
        name: d.name,
        operator: d.name,
        brand: d.builder?.name || '',
        city: loc.city?.name || '',
        micro,
        type: 'Private office',
        spaceTypes: ['Private office'],
        seats,
        price: rent,
        amenities,
        images,
        photoMeta: [],
        tier: '',
        avail: '',
        status,
        isActive: d.is_active !== false,
        addedBy: d.added_by_user || 'admin',
        description: stripHtml(d.description),
        plans: rent
            ? [{ label: officeType ? `${officeType} office` : 'Office for lease', type: 'Private office', price: rent, unit: 'month', seats: seats || 1, onRequest: false }]
            : [{ label: officeType ? `${officeType} office` : 'Office for lease', type: 'Private office', price: 0, unit: 'month', seats: seats || 1, onRequest: true }],
        hours: [],
        privateOffice: {
            officeType,
            areaSqft: num(o.area_for_lease_in_sq_ft),
            rentPerSqft: Math.round(num(o.rent_in_sq_ft) * 100) / 100,
            monthlyRent: rent,
            floor: o.floor || loc.floor || '',
            maintenance: /^y/i.test(o.monthly_maintenance || '') ? (o.monthly_maintenance_amount ? `Extra · ₹${o.monthly_maintenance_amount}` : 'Extra') : 'Included',
            securityDeposit: o.security_deposit || '',
            facilities,
            buildingName,
            howToReach: o.how_to_reach || '',
            sundayOpen: !!d.hours_of_operation?.is_sunday_open,
            open24: !!d.hours_of_operation?.is_open_24,
        },
        url: '',
        adminUrl: `${ADMIN_URL}/layout/office-space/detail/${id}`,
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
                nearestMetro: metro,
                landmark: [loc.landmark, loc.landmark_distance].filter(Boolean).join(' · '),
                floors: o.floor || loc.floor || '',
                carpet: num(o.area_for_lease_in_sq_ft),
            },
            capacity: { totalSeats: seats },
            pricing: rent ? { privateOffice: rent } : {},
            operations: {
                timings: d.hours_of_operation?.is_open_24 ? 'Open 24 hours' : '',
                daysOpen: d.hours_of_operation?.is_sunday_open ? 'All 7 days' : 'Mon – Sat',
                sundayVisits: !!d.hours_of_operation?.is_sunday_open,
                virtualOfficeAvailable: false,
                managedOfficeAvailable: false,
            },
            contactsMedia: {
                centerManager: { name: d.space_contact_details?.name || '', phone: d.space_contact_details?.phone || '' },
                communityManager: { name: '', phone: '' },
                salesPhone: d.space_contact_details?.phone || '',
                salesEmail: d.space_contact_details?.email || '',
                extraAmenities: amenities,
                gallery: images,
                website: '',
                instagram: '',
            },
        },
    };
}

/** CRM filters → an OfficeSpace query (null = can't match). */
export async function privateOfficeQuery(filters = {}, search = '') {
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
    if (filters.officeType && OFFICE_TYPES[filters.officeType]) and.push({ 'other_detail.office_type': filters.officeType });
    if (typeof filters.maxPrice === 'number') and.push({ 'other_detail.monthly_rent': { $gt: 0, $lte: filters.maxPrice } });
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
        text: ['name', 'slug', 'location.address', 'location.name', 'location.micro_location_string', 'location.landmark',
            'location.metro_detail.name', 'other_detail.building_name', 'location.property_id', 'productId'],
        city: 'location.city',
        micro: 'location.micro_location',
    })));
    return and.length ? { $and: and } : {};
}

export async function privateOfficeStatusCounts(filters, search) {
    const out = { all: 0, approved: 0, pending: 0, inprogress: 0, rejected: 0 };
    const q = await privateOfficeQuery({ ...filters, status: undefined }, search);
    if (!q) return out;
    const rows = await OfficeSpace.aggregate([{ $match: q }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
    for (const r of rows) {
        out[(LISTING_STATUSES[r._id] || LISTING_STATUSES.pending).key] += r.n;
        out.all += r.n;
    }
    return out;
}

export { OfficeSpace };
