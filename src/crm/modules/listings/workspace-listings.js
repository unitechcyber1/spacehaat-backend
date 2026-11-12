import { Types } from 'mongoose';
import models from '../../../models/index.js';

/**
 * CRM inventory = the website's coworking spaces (the `WorkSpace` collection the admin panel manages).
 * Each space is turned into the listing shape the CRM apps, proposals, PDFs and Smart Match already use,
 * so those keep working unchanged. Old CRM `Listing` docs are still read for proposals that point at them.
 */
const { WorkSpace, Listing, City, Amenty, Category } = models;

const SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://spacewallah.com').replace(/\/$/, '');
const ADMIN_URL = (process.env.FRONTEND_URL || 'https://admin.spacehaat.com').replace(/\/$/, '');
const DAY_PASS = '6231b1722a52af3ddaa73a44';
const VIRTUAL_OFFICE = '6231bca42a52af3ddaa73ab1';
const MS_DAY = 864e5;

/** WorkSpace.status → what staff see. */
export const LISTING_STATUSES = {
    approve: { key: 'approved', label: 'Approved' },
    pending: { key: 'pending', label: 'Pending' },
    inprogress: { key: 'inprogress', label: 'In progress' },
    reject: { key: 'rejected', label: 'Rejected' },
};
const STATUS_FROM_KEY = { approved: 'approve', pending: 'pending', inprogress: 'inprogress', rejected: 'reject' };

/** Plan category name → CRM space type + pricing field. */
const PLAN_KINDS = [
    { re: /hot\s*desk|flexi/i, type: 'Hot desk', field: 'hotDesk' },
    { re: /dedicated/i, type: 'Dedicated desk', field: 'dedicatedDesk' },
    { re: /cabin|private\s*office/i, type: 'Private cabin', field: 'privateCabin' },
    { re: /managed/i, type: 'Managed office', field: 'managedOffice' },
    { re: /day\s*pass/i, type: 'Day pass', field: 'dayPass' },
    { re: /virtual/i, type: 'Virtual office', field: 'virtualOffice' },
    { re: /meeting/i, type: 'Meeting room', field: 'meetingRoomHour' },
    { re: /conference|board/i, type: 'Conference room', field: 'confRoomHour' },
];
const kindOf = (plan) => {
    const id = String(plan.category?._id || plan.category || '');
    if (id === DAY_PASS) return PLAN_KINDS.find((k) => k.field === 'dayPass');
    if (id === VIRTUAL_OFFICE) return PLAN_KINDS.find((k) => k.field === 'virtualOffice');
    const name = plan.category?.name || '';
    return PLAN_KINDS.find((k) => k.re.test(name)) || null;
};

/** Space types a seat-based enquiry can match (day pass / VO / rooms don't seat a team). */
const SEAT_TYPES = new Set(['Hot desk', 'Dedicated desk', 'Private cabin', 'Managed office']);

export const POPULATE = [
    { path: 'images.image', select: 's3_link' },
    { path: 'amenties', select: 'name' },
    { path: 'plans.category', select: 'name' },
    { path: 'location.city', select: 'name' },
    { path: 'location.micro_location', select: 'name' },
    { path: 'brand', select: 'name' },
];

const daysSince = (d) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / MS_DAY));

export function freshOfDays(days) {
    if (days <= 5) return { state: 'fresh', label: days === 0 ? 'Verified today' : `Verified ${days}d ago`, days };
    if (days <= 14) return { state: 'stale', label: `${days}d ago`, days };
    return { state: 'expired', label: `${days}d — re-verify`, days };
}

export function freshnessRange(freshness) {
    const now = Date.now();
    if (freshness === 'fresh') return { $gte: new Date(now - 5 * MS_DAY) };
    if (freshness === 'stale') return { $gte: new Date(now - 14 * MS_DAY), $lt: new Date(now - 5 * MS_DAY) };
    return { $lt: new Date(now - 14 * MS_DAY) };
}

const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
const firstOf = (v) => (Array.isArray(v) ? v[0] : v);
const person = (c) => ({ name: c?.name || '', phone: c?.phone_number || c?.phone || '' });

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
function hours(h = {}) {
    const mon = h.monday || {};
    const open = (d) => d && (d.is_open_24 || (!d.is_closed && String(d.from || '').trim()));
    const timings = mon.is_open_24 ? 'Open 24 hours' : open(mon) ? `${mon.from} – ${mon.to}` : '';
    const openDays = DAY_NAMES.filter((d, i) => (i < 5 ? open(h[d]) || open(mon) : open(h[d])));
    const daysOpen = openDays.length === 7 ? 'All 7 days'
        : openDays.length === 6 && !openDays.includes('sunday') ? 'Mon – Sat'
            : openDays.length === 5 && !openDays.includes('saturday') ? 'Mon – Fri'
                : openDays.map((d) => d.slice(0, 3).replace(/^./, (c) => c.toUpperCase())).join(', ');
    const rows = [['Mon – Fri', mon], ['Saturday', h.saturday], ['Sunday', h.sunday]].map(([label, d]) => {
        if (!d) return null;
        if (d.is_open_24) return { label, value: 'Open 24 hours' };
        if (d.is_closed || !String(d.from || '').trim()) return { label, value: 'Closed' };
        return { label, value: `${d.from} – ${d.to}` };
    }).filter(Boolean);
    return { timings, daysOpen, sundayOpen: open(h.sunday), rows };
}

/**
 * A populated WorkSpace → CRM listing. `operator`, `micro`, `city`, `seats`, `price`, `type`, `images`,
 * `amenities`, `fresh` and `profile` are what proposals, the PDF and Smart Match read.
 */
export function toCrmListing(d) {
    const loc = d.location || {};
    const micro = firstOf(loc.micro_location);
    const plans = (d.plans || []).filter((p) => p && p.should_show !== false && Number(p.price) > 0);

    const pricing = {};
    const planRows = [];
    const types = [];
    for (const p of plans) {
        const kind = kindOf(p);
        const label = p.category?.name || kind?.type || 'Plan';
        planRows.push({ label, type: kind?.type || label, price: Number(p.price), unit: p.duration || 'month', seats: p.number_of_items || 1 });
        if (kind && !types.includes(kind.type)) types.push(kind.type);
        if (kind && (pricing[kind.field] == null || p.price < pricing[kind.field])) pricing[kind.field] = Number(p.price);
    }
    planRows.sort((a, b) => a.price - b.price);

    const seatPrices = planRows.filter((p) => SEAT_TYPES.has(p.type) && p.unit === 'month').map((p) => p.price);
    const price = Number(d.starting_price) > 0 ? Number(d.starting_price) : seatPrices.length ? Math.min(...seatPrices) : 0;
    const seatTypes = types.filter((t) => SEAT_TYPES.has(t));

    const images = [...(d.images || [])].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
        .map((i) => i?.image?.s3_link).filter(Boolean);
    const amenities = (d.amenties || []).map((a) => a?.name).filter(Boolean);
    const h = hours(d.hours_of_operation);
    const status = LISTING_STATUSES[d.status] || LISTING_STATUSES.pending;
    const verifiedAt = d.crm_verified_at || null;
    const updatedAt = d.updated_on || d.added_on || d.createdAt || d._id.getTimestamp();
    const lat = Number(loc.latitude);
    const lng = Number(loc.longitude);
    const hasPoint = Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng);
    const address = [loc.floor, loc.address1 || loc.address, loc.postal_code].filter(Boolean).join(', ');
    const contacts = d.contact_details || [];
    const sales = d.space_contact_details || {};
    const id = String(d._id);

    return {
        _id: id,
        id,
        source: 'workspace',
        name: d.name,
        operator: d.name,
        brand: d.brand?.name || '',
        city: loc.city?.name || '',
        micro: micro?.name || loc.micro_location_string || loc.name || '',
        type: seatTypes[0] || types[0] || 'Coworking',
        spaceTypes: types,
        seats: Number(d.no_of_seats) || 0,
        price,
        amenities,
        images,
        photoMeta: [],
        tier: '',
        avail: '',
        status,
        isActive: d.is_active !== false,
        addedBy: d.added_by_user || 'admin',
        description: stripHtml(d.description || d.new_description),
        plans: planRows,
        hours: h.rows,
        url: d.status === 'approve' && d.slug ? `${SITE_URL}/coworking/${d.slug}` : '',
        adminUrl: `${ADMIN_URL}/layout/coworking/spaces/detail/${id}`,
        verifiedAt,
        updatedAt,
        createdAt: d.added_on || d.createdAt || d._id.getTimestamp(),
        fresh: (verifiedAt || d.updated_on || d.createdAt)
            ? freshOfDays(daysSince(verifiedAt || d.updated_on || d.createdAt))
            : { state: 'expired', label: 'Never verified', days: 999 },
        profile: {
            identity: {
                centreName: d.name,
                address,
                mapsLink: hasPoint ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
                    : address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.name}, ${address}`)}` : '',
                nearestMetro: loc.is_near_metro || loc.metro_stop_landmark ? loc.metro_stop_landmark || '' : '',
                landmark: [loc.landmark, loc.landmark_distance].filter(Boolean).join(' · '),
                floors: loc.floor || '',
            },
            capacity: { totalSeats: Number(d.no_of_seats) || 0 },
            pricing,
            operations: {
                timings: h.timings,
                daysOpen: h.daysOpen,
                sundayVisits: Boolean(h.sundayOpen),
                virtualOfficeAvailable: types.includes('Virtual office'),
                managedOfficeAvailable: types.includes('Managed office'),
            },
            contactsMedia: {
                centerManager: person(contacts[0]),
                communityManager: person(contacts[1]),
                salesPhone: sales.phone || contacts[0]?.phone_number || '',
                salesEmail: sales.email || d.email || '',
                extraAmenities: amenities,
                gallery: images,
                website: d.website_Url || '',
                instagram: d.social_media?.instagram || '',
            },
        },
    };
}

const escape = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** City names the CRM uses ↔ how the website stores them. */
const CITY_ALIASES = {
    gurugram: ['gurugram', 'gurgaon'],
    gurgaon: ['gurugram', 'gurgaon'],
    bangalore: ['bangalore', 'bengaluru'],
    bengaluru: ['bangalore', 'bengaluru'],
    delhi: ['delhi', 'new delhi'],
    'new delhi': ['new delhi', 'delhi'],
};

const aliasesOf = (n) => CITY_ALIASES[String(n || '').toLowerCase().trim()] || [String(n || '').toLowerCase().trim()];

/** Is this space's city inside the user's cities (null scope = all cities)? Handles Gurgaon/Gurugram etc. */
export function inCityScope(scope, city) {
    if (scope === null || scope === undefined) return true;
    const have = new Set(aliasesOf(city));
    return scope.some((c) => aliasesOf(c).some((a) => have.has(a)));
}

async function cityIds(names) {
    const wanted = [...new Set(names.flatMap((n) => CITY_ALIASES[String(n).toLowerCase().trim()] || [String(n).toLowerCase().trim()]))];
    if (!wanted.length) return [];
    const rows = await City.find({ name: { $in: wanted.map((n) => new RegExp(`^${escape(n)}$`, 'i')) } }).select('_id').lean();
    return rows.map((r) => r._id);
}

async function categoryIds(type) {
    const kind = PLAN_KINDS.find((k) => k.type.toLowerCase() === String(type).toLowerCase());
    if (!kind) return [];
    const rows = await Category.find({ name: kind.re }).select('_id').lean();
    const ids = rows.map((r) => r._id);
    if (kind.field === 'dayPass') ids.push(new Types.ObjectId(DAY_PASS));
    if (kind.field === 'virtualOffice') ids.push(new Types.ObjectId(VIRTUAL_OFFICE));
    return ids;
}

/** CRM filters → a WorkSpace query. Returns null when the filters can't match anything. */
export async function workspaceQuery(filters = {}, search = '') {
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

    if (filters.type && filters.type !== 'All') {
        const ids = await categoryIds(filters.type);
        if (!ids.length) return null;
        and.push({ 'plans.category': { $in: ids } });
    }
    if (filters.hotDesk) {
        const ids = await categoryIds('Hot desk');
        if (!ids.length) return null;
        and.push({ 'plans.category': { $in: ids } });
    }
    if (filters.virtualOffice) and.push({ 'plans.category': new Types.ObjectId(VIRTUAL_OFFICE) });
    if (filters.managedOffice) {
        const ids = await categoryIds('Managed office');
        if (!ids.length) return null;
        and.push({ 'plans.category': { $in: ids } });
    }
    if (typeof filters.maxPrice === 'number') and.push({ starting_price: { $gt: 0, $lte: filters.maxPrice } });
    if (typeof filters.minSeats === 'number' && filters.minSeats > 0) and.push({ no_of_seats: { $gte: filters.minSeats } });
    if (filters.amenities?.length) {
        const rows = await Amenty.find({ name: { $in: filters.amenities.map((a) => new RegExp(`^${escape(a)}$`, 'i')) } }).select('_id').lean();
        if (rows.length < filters.amenities.length) return null;
        and.push({ amenties: { $all: rows.map((r) => r._id) } });
    }
    if (filters.freshness) {
        const range = freshnessRange(filters.freshness);
        const or = [{ crm_verified_at: range }, { crm_verified_at: null, updated_on: range }, { crm_verified_at: null, updated_on: null, createdAt: range }];
        // Never checked and no dates at all: treat as needing re-verification.
        if (filters.freshness === 'expired') or.push({ crm_verified_at: null, updated_on: null, createdAt: null });
        and.push({ $or: or });
    }

    const tokens = String(search || '').trim().split(/\s+/).filter(Boolean).slice(0, 6);
    for (const token of tokens) {
        const re = new RegExp(escape(token), 'i');
        and.push({
            $or: [
                { name: re },
                { 'location.address1': re },
                { 'location.micro_location_string': re },
                { 'location.name': re },
                { 'location.landmark': re },
                { 'location.metro_stop_landmark': re },
            ],
        });
    }
    return and.length ? { $and: and } : {};
}

/** Count per status for the given filters (status filter itself ignored), for the status chips. */
export async function statusCounts(filters, search) {
    const q = await workspaceQuery({ ...filters, status: undefined }, search);
    if (!q) return { all: 0, approved: 0, pending: 0, inprogress: 0, rejected: 0 };
    const rows = await WorkSpace.aggregate([{ $match: q }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
    const out = { all: 0, approved: 0, pending: 0, inprogress: 0, rejected: 0 };
    for (const r of rows) {
        const key = (LISTING_STATUSES[r._id] || LISTING_STATUSES.pending).key;
        out[key] += r.n;
        out.all += r.n;
    }
    return out;
}

const isId = (v) => Types.ObjectId.isValid(String(v || '')) && /^[a-f0-9]{24}$/i.test(String(v));

function legacyRow(l) {
    const days = l.verifiedAt ? daysSince(l.verifiedAt) : 0;
    return { ...l, id: String(l._id), source: 'legacy', fresh: freshOfDays(days) };
}

/** Listings by id, in the order given: website spaces first, old CRM listings for older proposals. */
export async function listingsByIds(ids) {
    const valid = (ids || []).map(String).filter(isId);
    if (!valid.length) return [];
    const ws = await WorkSpace.find({ _id: { $in: valid } }).populate(POPULATE).lean();
    const map = new Map(ws.map((d) => [String(d._id), toCrmListing(d)]));
    const missing = valid.filter((id) => !map.has(id));
    if (missing.length) {
        const old = await Listing.find({ _id: { $in: missing } }).lean();
        for (const l of old) map.set(String(l._id), legacyRow(l));
    }
    return valid.map((id) => map.get(id)).filter(Boolean);
}

/** The ids (as given) that point at a real listing. */
export async function existingListingIds(ids) {
    const valid = (ids || []).map(String).filter(isId);
    if (!valid.length) return [];
    const [ws, old] = await Promise.all([
        WorkSpace.find({ _id: { $in: valid } }).select('_id').lean(),
        Listing.find({ _id: { $in: valid } }).select('_id').lean(),
    ]);
    const found = new Set([...ws, ...old].map((d) => String(d._id)));
    return valid.filter((id) => found.has(id));
}

export async function listingById(id) {
    const [l] = await listingsByIds([id]);
    return l || null;
}

export function isWorkspaceListing(l) {
    return l?.source === 'workspace';
}

export { WorkSpace };
