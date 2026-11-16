import models from '../../../models/index.js';
import managePg from '../../../services/admin/manage-pg.js';
import { ApiError } from '../../utils/apiError.js';
import { img, isId, str } from './workspace-editor.js';
import { PG_STATUSES, PG_STATUS_FROM_KEY } from './pg-listings.js';

/**
 * Add / edit PGs (website `/coliving`, `PG` collection) from the CRM apps. Saves go through the admin
 * panel's PG service, so slugs, PG ids, owners and duplicate checks behave exactly as in the admin.
 * Choices use the values already stored on PGs ("Boys" / "Girls" / "Co-living", "Double Bed", "Mon-Fri"…).
 */
const { PG, Country } = models;

const GENDERS = ['Boys', 'Girls', 'Co-living'];
const GUESTS = ['Both', 'Students', 'Working Professional'];
const POSTED_BY = ['Owner', 'Agent'];
const ROOM_TYPES = ['Single Bed', 'Double Bed', 'Triple Bed', 'Four Bed', 'Others'];
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Evening Snacks'];
const LAUNDRY_DAYS = ['Mon-Fri', 'Mon-Sun', 'Weekly'];
const VEHICLES = ['Both', 'Bike', 'Car'];
const SCHEDULES = ['Available All Day', 'Specific time'];
const DEFAULT_COMMON = ['Wi-fi', 'Power-Back Up', 'Water Cooler', 'First Aid Kit', 'Warden/ Manager', 'Fridge', 'Security Guard', 'Microwave', 'Lift', 'Gym', 'CCTV', 'TV Lounge'];
const DEFAULT_ROOM = ['Mattress + Pillow', 'Hot Water', 'Table + Chair', 'Single Bed', 'Queen Bed', 'Cupboard', 'AC/ Heating', 'Side Table', 'Television', 'Blanket/Quilt', 'Attached Bath', 'Balcony'];
const DEFAULT_RULES = ['Rent lock-in', 'No guardians stay', 'Non-Veg allowed', 'Party allowed', 'Smoking not allowed', 'Opposite gender allowed', 'Drink not allowed'];

let optionsCache = null;

/** Values used on 3+ PGs (most used first), merged with the usual ones so the lists stay complete. */
async function usedValues(field, defaults) {
    const rows = await PG.aggregate([
        { $match: { delete: { $ne: true } } },
        { $unwind: `$${field}` },
        { $group: { _id: `$${field}`, n: { $sum: 1 } } },
        { $match: { n: { $gte: 3 } } },
        { $sort: { n: -1 } },
        { $limit: 40 },
    ]);
    const seen = new Set();
    const out = [];
    for (const v of [...rows.map((r) => r._id), ...defaults]) {
        const s = String(v || '').trim();
        if (!s || seen.has(s.toLowerCase())) continue;
        seen.add(s.toLowerCase());
        out.push(s);
    }
    return out;
}

export async function pgEditorOptions() {
    if (optionsCache && optionsCache.at > Date.now() - 10 * 60e3) return optionsCache.data;
    const [countries, commonAmenities, roomAmenities, rules] = await Promise.all([
        Country.find({}).select('name').sort({ name: 1 }).lean(),
        usedValues('availableAmenities', DEFAULT_COMMON),
        usedValues('roomAmenities', DEFAULT_ROOM),
        usedValues('pgHostelRule', DEFAULT_RULES),
    ]);
    const data = {
        vertical: 'coliving',
        countries: countries.map((c) => ({ id: String(c._id), name: c.name })),
        genders: GENDERS,
        guests: GUESTS,
        postedBy: POSTED_BY,
        roomTypes: ROOM_TYPES,
        meals: MEALS,
        laundryDays: LAUNDRY_DAYS,
        vehicles: VEHICLES,
        schedules: SCHEDULES,
        commonAmenities,
        roomAmenities,
        rules,
        statuses: [
            { key: 'inprogress', label: 'In progress' },
            { key: 'approved', label: 'Approved (live on website)' },
            { key: 'rejected', label: 'Rejected' },
        ],
        googleIndex: [
            { key: 'auto', label: 'Automatic' },
            { key: 'index', label: 'Always in Google' },
            { key: 'noindex', label: 'Never in Google' },
        ],
    };
    optionsCache = { at: Date.now(), data };
    return data;
}

const EDIT_POPULATE = [
    { path: 'images.image' },
    { path: 'locationIds.country', select: 'name' },
    { path: 'locationIds.state', select: 'name' },
    { path: 'locationIds.city', select: 'name' },
    { path: 'locationIds.micro_location', select: 'name' },
];

const idOf = (v) => (v && typeof v === 'object' ? String(v._id || '') : v ? String(v) : '');
const nameOf = (v) => (v && typeof v === 'object' ? v.name || '' : '');
const numText = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? '' : String(v));
const dateText = (v) => {
    if (!v) return '';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
};

function toEditable(d) {
    const li = d.locationIds || {};
    const micro = Array.isArray(li.micro_location) ? li.micro_location[0] : li.micro_location;
    const coords = d.location?.coordinates || [];
    return {
        vertical: 'coliving',
        id: String(d._id),
        name: d.name || '',
        slug: d.slug || '',
        pgId: d.pg_id || '',
        status: (PG_STATUSES[d.status] || PG_STATUSES.inprogress).key,
        isActive: d.active !== false,
        gender: d.availableFor || '',
        guests: d.preferredGuest || 'Both',
        postedBy: d.postBy || 'Owner',
        contactNumber: d.contactNumber || '',
        contactEmail: d.contactEmail || '',
        location: {
            country: idOf(li.country), state: idOf(li.state), city: idOf(li.city), microLocation: idOf(micro),
            address: d.address || '', street: d.street || '',
            latitude: numText(coords[1]), longitude: numText(coords[0]),
        },
        labels: {
            country: nameOf(li.country), state: nameOf(li.state),
            city: nameOf(li.city) || d.city || '', microLocation: nameOf(micro) || d.locality || '',
        },
        rooms: (d.pgRooms || []).map((r) => ({ type: r.roomType || '', rent: numText(r.monthlyRent), deposit: numText(r.expectedDeposit) })),
        availableFrom: dateText(d.availableFrom),
        notice: { on: Boolean(d.noticePeriod), days: numText(d.noticePeriodDuration) || '30' },
        maintenance: { on: Boolean(d.maintenanceAmount), amount: d.maintenanceAmountValue || '' },
        food: { on: Boolean(d.foodIncluded), meals: d.includedMeals || [] },
        laundry: { on: Boolean(d.isLaundryService), days: d.laundryService?.days || 'Mon-Fri' },
        cleaning: Boolean(d.roomCleaning),
        water: Boolean(d.waterFacility),
        parking: { on: Boolean(d.parking), vehicle: d.vehicleType || 'Both' },
        gate: { on: Boolean(d.gateClosing), time: d.gateClosingTime || '' },
        contactSchedule: d.selectTimeSchedule === 'Specific time' ? 'Specific time' : 'Available All Day',
        startTime: d.startTime || '',
        endTime: d.endTime || '',
        commonAmenities: d.availableAmenities || [],
        roomAmenities: d.roomAmenities || [],
        rules: d.pgHostelRule || [],
        rating: numText(d.rating),
        newDescription: d.new_description || '',
        description: d.description || '',
        photos: [...(d.images || [])].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0)).map((i) => img(i?.image)).filter(Boolean),
        googleIndex: ['index', 'noindex'].includes(d.seo_index_override) ? d.seo_index_override : 'auto',
        googleAuto: { ok: typeof d.seo_quality_ok === 'boolean' ? d.seo_quality_ok : null, note: d.seo_quality_note || '' },
        verification: { at: d.verified_at || null, by: d.verified_by || '', method: d.verified_method || '' },
    };
}

export async function getPgEditable(id) {
    if (!isId(String(id))) return null;
    const d = await PG.findOne({ _id: id, delete: { $ne: true } }).populate(EDIT_POPULATE).lean();
    return d ? toEditable(d) : null;
}

const money = (v) => {
    const n = Number(String(v ?? '').replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};
const validDate = (v) => {
    const t = str(v, 30);
    if (!t) return null;
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d;
};
const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
const list = (v, max = 60) => [...new Set((Array.isArray(v) ? v : []).map((x) => str(x, 80)).filter(Boolean))].slice(0, max);

/** Form → PG fields (only what the form edits, so other admin-only fields stay as they are). */
function toPgFields(body, { isAdmin, existing }) {
    const L = body.location || {};
    const labels = body.labels || {};
    const city = str(labels.city, 120);
    const locality = str(labels.microLocation, 160);
    const address = str(L.address, 500);
    const rooms = (Array.isArray(body.rooms) ? body.rooms : [])
        .filter((r) => r && str(r.type))
        .slice(0, 12)
        .map((r, i) => ({
            roomType: str(r.type, 40),
            monthlyRent: money(r.rent),
            expectedDeposit: money(r.deposit),
            roomImage: existing?.pgRooms?.[i]?.roomImage || [],
        }));
    const rents = rooms.map((r) => r.monthlyRent).filter((n) => n > 0);
    const single = rooms.find((r) => /single/i.test(r.roomType) && r.monthlyRent > 0);
    const lat = Number(L.latitude);
    const lng = Number(L.longitude);
    const hasPoint = String(L.latitude ?? '').trim() && String(L.longitude ?? '').trim() && Number.isFinite(lat) && Number.isFinite(lng);
    const notice = body.notice || {};
    const maint = body.maintenance || {};
    const food = body.food || {};
    const laundry = body.laundry || {};
    const parking = body.parking || {};
    const gate = body.gate || {};
    const specific = body.contactSchedule === 'Specific time';

    const out = {
        name: str(body.name, 200),
        availableFor: pick(body.gender, GENDERS, existing?.availableFor || 'Co-living'),
        preferredGuest: pick(body.guests, GUESTS, existing?.preferredGuest || 'Both'),
        postBy: pick(body.postedBy, POSTED_BY, existing?.postBy || 'Owner'),
        contactNumber: str(body.contactNumber, 20),
        contactEmail: str(body.contactEmail, 200),
        city,
        locality,
        address,
        street: str(L.street, 200),
        locationIds: {
            country: isId(L.country) ? L.country : undefined,
            state: isId(L.state) ? L.state : undefined,
            city: isId(L.city) ? L.city : undefined,
            micro_location: isId(L.microLocation) ? [L.microLocation] : [],
            address: [address, locality, city].filter(Boolean).join(', '),
        },
        ...(hasPoint ? { location: { type: 'Point', coordinates: [lng, lat] } } : {}),
        pgRooms: rooms,
        minMonthlyRent: rents.length ? Math.min(...rents) : 0,
        maxMonthlyRent: rents.length ? Math.max(...rents) : 0,
        singleRoomPrice: single ? single.monthlyRent : 0,
        availableFrom: validDate(body.availableFrom),
        noticePeriod: Boolean(notice.on),
        noticePeriodDuration: notice.on ? money(notice.days) || 30 : 0,
        maintenanceAmount: Boolean(maint.on),
        maintenanceAmountValue: maint.on ? str(maint.amount, 40) : '',
        foodIncluded: Boolean(food.on),
        includedMeals: food.on ? list(food.meals).filter((m) => MEALS.includes(m)) : [],
        isLaundryService: Boolean(laundry.on),
        laundryService: { title: pick(laundry.days, LAUNDRY_DAYS, 'Mon-Fri'), days: pick(laundry.days, LAUNDRY_DAYS, 'Mon-Fri') },
        roomCleaning: Boolean(body.cleaning),
        waterFacility: Boolean(body.water),
        parking: Boolean(parking.on),
        vehicleType: parking.on ? pick(parking.vehicle, VEHICLES, 'Both') : '',
        gateClosing: Boolean(gate.on),
        gateClosingTime: gate.on ? str(gate.time, 20) : '',
        selectTimeSchedule: specific ? 'Specific time' : 'Available All Day',
        startTime: specific ? str(body.startTime, 20) : '',
        endTime: specific ? str(body.endTime, 20) : '',
        availableAmenities: list(body.commonAmenities),
        roomAmenities: list(body.roomAmenities),
        pgHostelRule: list(body.rules),
        rating: Math.min(5, Math.max(0, Number(body.rating) || 0)),
        images: (Array.isArray(body.photos) ? body.photos : [])
            .map((p) => (isId(String(p?.id || '')) ? String(p.id) : null))
            .filter(Boolean)
            .slice(0, 40)
            .map((image, i) => ({ image, order: i + 1 })),
        active: body.isActive !== false,
        seo_index_override: pick(body.googleIndex, ['auto', 'index', 'noindex'], 'auto'),
        form_status: 'Complete',
    };
    // Description: the website shows `new_description` (HTML) first; the form edits that text.
    if (typeof body.newDescription === 'string') out.new_description = body.newDescription.slice(0, 50000);
    if (!out.locationIds.country) delete out.locationIds.country;
    if (!out.locationIds.state) delete out.locationIds.state;
    if (!out.locationIds.city) delete out.locationIds.city;
    if (isAdmin && PG_STATUS_FROM_KEY[body.status]) out.status = PG_STATUS_FROM_KEY[body.status];
    if (existing && typeof body.slug === 'string' && body.slug.trim()) out.slug = body.slug.trim();
    return out;
}

function requireFields(body) {
    const missing = [];
    if (!str(body.name)) missing.push('PG name');
    if (!str(body.labels?.city) && !isId(body.location?.city)) missing.push('City');
    if (!(Array.isArray(body.rooms) && body.rooms.some((r) => str(r?.type)))) missing.push('At least one room type');
    if (missing.length) throw new ApiError(400, `Please fill in: ${missing.join(', ')}`, 'MISSING_FIELDS');
}

const fromServiceError = (err) => {
    const status = err?.statusCode || err?.status;
    return status && status < 500 ? new ApiError(status, err.message, 'PG_SAVE_FAILED') : err;
};

export async function createPgFromCrm(body, user) {
    requireFields(body);
    const fields = toPgFields(body, { isAdmin: user?.role === 'admin', existing: null });
    if (!fields.status) fields.status = 'inprogress';
    try {
        const created = await managePg.createPg(fields);
        return String(created._id);
    } catch (err) {
        throw fromServiceError(err);
    }
}

export async function updatePgFromCrm(id, body, user) {
    requireFields(body);
    const existing = await PG.findOne({ _id: id, delete: { $ne: true } }).lean();
    if (!existing) return null;
    const fields = toPgFields(body, { isAdmin: user?.role === 'admin', existing });
    try {
        await managePg.updatePg({ id: String(id), ...fields });
        return String(id);
    } catch (err) {
        throw fromServiceError(err);
    }
}
