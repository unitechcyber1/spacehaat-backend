import { Types } from 'mongoose';
import { canEnableListings } from '../auth/permissions.js';
import models from '../../../models/index.js';
import { slugifyText } from '../../../utilities/pg-slug.js';
import { ApiError } from '../../utils/apiError.js';
import {
    PLAN_DURATIONS, STATUS_FROM_DB, STATUS_TO_DB, WEEKDAYS,
    bool, duplicateError, idOf, img, imageId, isId, num, seoForDb, seoForForm, str,
} from './workspace-editor.js';

/**
 * Add / edit managed offices (website `/managed-office`, `ManagedOffice` collection) from the CRM apps,
 * with the admin panel's rules: unique slug (name + locality, "-2" suffix), geometry from lat/lng,
 * closed days kept visible as "Closed", priority city refs aligned with the location.
 */
const { ManagedOffice, Brand, Country, Category, Amenty } = models;

export const SEAT_TYPE_OPTIONS = [
    { key: 'ready_to_move_in', label: 'Ready to move in' },
    { key: 'warm_shell', label: 'Warm shell' },
    { key: 'bare_shell', label: 'Bare shell' },
];
const SEAT_KEYS = SEAT_TYPE_OPTIONS.map((s) => s.key);
/** "Office Space" plan category — the default for managed office seat plans (admin panel). */
export const OFFICE_SPACE_CATEGORY_ID = '62833d8193f2bd4e9f1a3ceb';

let optionsCache = null;
export async function managedOfficeEditorOptions() {
    if (optionsCache && optionsCache.at > Date.now() - 10 * 60e3) return optionsCache.data;
    const [brands, amenities, categories, countries] = await Promise.all([
        Brand.find({}).select('name type').sort({ name: 1 }).collation({ locale: 'en', strength: 2 }).lean(),
        Amenty.find({ $or: [{ for_office: true }, { for_coWorking: true }] }).select('name category').sort({ name: 1 }).lean(),
        Category.find({ active: true }).select('name').sort({ name: 1 }).lean(),
        Country.find({}).select('name for_office').sort({ name: 1 }).lean(),
    ]);
    const opt = (r) => ({ id: String(r._id), name: r.name });
    const data = {
        vertical: 'managed-office',
        brands: brands.map(opt),
        amenities: amenities.map((a) => ({ ...opt(a), category: a.category || 'others' })),
        planTypes: categories.map(opt),
        defaultPlanType: categories.some((c) => String(c._id) === OFFICE_SPACE_CATEGORY_ID) ? OFFICE_SPACE_CATEGORY_ID : '',
        countries: [...countries].sort((a, b) => Number(!!b.for_office) - Number(!!a.for_office)).map(opt),
        seatTypes: SEAT_TYPE_OPTIONS,
        centreTypes: [
            { key: 'managed_office', label: 'Managed office' },
            { key: 'coworking', label: 'Coworking centre' },
        ],
        durations: PLAN_DURATIONS,
        statuses: [
            { key: 'pending', label: 'Pending' },
            { key: 'inprogress', label: 'In progress' },
            { key: 'approved', label: 'Approved (live on website)' },
            { key: 'rejected', label: 'Rejected' },
        ],
    };
    optionsCache = { at: Date.now(), data };
    return data;
}

function hoursForForm(h = {}) {
    const out = {};
    for (const day of WEEKDAYS) {
        const r = h?.[day];
        out[day] = r
            ? { open: !!r.should_show && !r.is_closed, allDay: !!r.is_open_24, from: r.from || '09:00 AM', to: r.to || '08:00 PM' }
            : { open: day !== 'sunday', allDay: false, from: '09:00 AM', to: '08:00 PM' };
    }
    return out;
}

/** Same as the admin form: closed days stay listed as "Closed"; 24h = 12:00 AM – 11:59 PM. */
function hoursForDb(h = {}) {
    const out = {};
    for (const day of WEEKDAYS) {
        const r = h?.[day] || {};
        if (!r.open) out[day] = { should_show: true, is_closed: true, is_open_24: false, from: '', to: '' };
        else if (r.allDay) out[day] = { should_show: true, is_closed: false, is_open_24: true, from: '12:00 AM', to: '11:59 PM' };
        else out[day] = { should_show: true, is_closed: false, is_open_24: false, from: str(r.from, 20) || '09:00 AM', to: str(r.to, 20) || '08:00 PM' };
    }
    return out;
}

const EDIT_POPULATE = [
    { path: 'brand', select: 'name' },
    { path: 'location.country', select: 'name' },
    { path: 'location.state', select: 'name' },
    { path: 'location.city', select: 'name' },
    { path: 'location.micro_location', select: 'name' },
    { path: 'images.image', select: 's3_link title' },
    { path: 'plans.image', select: 's3_link title' },
    { path: 'building.floors.floor_plan', select: 's3_link title' },
    ...['seo', 'new_seo'].flatMap((b) => [
        { path: `${b}.twitter.image`, select: 's3_link title' },
        { path: `${b}.open_graph.image`, select: 's3_link title' },
    ]),
];

function toEditable(d) {
    const loc = d.location || {};
    const b = d.building || {};
    const blank = (v) => (v === undefined || v === null ? '' : v);
    return {
        id: String(d._id),
        vertical: 'managed-office',
        name: d.name || '',
        slug: d.slug || '',
        status: STATUS_FROM_DB[d.status] || 'pending',
        isActive: d.is_active !== false,
        isNewLaunch: !!d.is_new_launch,
        centreType: d.centre_type === 'coworking' ? 'coworking' : 'managed_office',
        brand: idOf(d.brand),
        seats: blank(d.no_of_seats),
        description: d.description || '',
        newDescription: d.new_description || '',
        location: {
            country: idOf(loc.country),
            state: idOf(loc.state),
            city: idOf(loc.city),
            microLocation: idOf(loc.micro_location),
            areaText: loc.micro_location_string || '',
            name: loc.name || '',
            buildingName: loc.building_name || '',
            address: loc.address1 || '',
            floor: loc.floor || '',
            postalCode: loc.postal_code || '',
            landmark: loc.landmark || '',
            landmarkDistance: loc.landmark_distance || '',
            latitude: blank(loc.latitude),
            longitude: blank(loc.longitude),
        },
        metro: { on: !!loc.is_near_metro, name: loc.metro_stop_landmark || '', distance: loc.metro_stop_distance || '' },
        plans: (d.plans || []).map((p) => ({
            seatType: SEAT_KEYS.includes(p.seat_type) ? p.seat_type : '',
            type: idOf(p.category),
            price: blank(p.price),
            per: p.duration || 'month',
            show: p.should_show !== false,
            image: img(p.image),
        })),
        building: {
            totalFloors: blank(b.total_floors),
            superArea: blank(b.super_area),
            totalSeats: blank(b.total_seats),
            floors: (b.floors || []).map((f) => ({
                floor: blank(f.floor_number), area: blank(f.area), seats: blank(f.seats), plan: img(f.floor_plan),
            })),
        },
        lease: { minSeats: blank(d.lease_terms?.min_seats), minMonths: blank(d.lease_terms?.min_duration_months) },
        rating: { source: d.rating?.source || '', average: blank(d.rating?.average), total: blank(d.rating?.total) },
        hours: hoursForForm(d.hours_of_operation),
        amenities: (d.amenties || []).map(idOf).filter(Boolean),
        photos: [...(d.images || [])]
            .sort((a, b2) => (a?.order ?? 0) - (b2?.order ?? 0))
            .map((i) => img(i?.image))
            .filter(Boolean),
        seo: seoForForm(d.seo),
        newSeo: seoForForm(d.new_seo),
        labels: {
            brand: d.brand?.name || '',
            country: loc.country?.name || '',
            state: loc.state?.name || '',
            city: loc.city?.name || '',
            microLocation: loc.micro_location?.name || '',
        },
    };
}

export async function getManagedOfficeEditable(id) {
    if (!isId(String(id))) return null;
    const d = await ManagedOffice.findById(id).populate(EDIT_POPULATE).lean();
    return d ? toEditable(d) : null;
}

async function toDbUpdate(body, { isAdmin }) {
    const set = {};
    set.name = str(body.name, 200);
    if (isId(body.brand)) set.brand = body.brand;
    set.no_of_seats = num(body.seats);
    set.is_active = body.isActive !== false;
    set.is_new_launch = bool(body.isNewLaunch);
    set.centre_type = body.centreType === 'coworking' ? 'coworking' : 'managed_office';
    set.description = String(body.description ?? '').slice(0, 50000);
    set.new_description = String(body.newDescription ?? '').slice(0, 50000);
    if (isAdmin && STATUS_TO_DB[body.status]) set.status = STATUS_TO_DB[body.status];

    const L = body.location || {};
    for (const k of ['country', 'state', 'city']) set[`location.${k}`] = isId(L[k]) ? L[k] : undefined;
    set['location.micro_location'] = isId(L.microLocation) ? L.microLocation : undefined;
    set['location.micro_location_string'] = str(L.areaText, 200);
    set['location.name'] = str(L.name, 200);
    set['location.building_name'] = str(L.buildingName, 200);
    set['location.address1'] = str(L.address, 500);
    set['location.floor'] = str(L.floor, 100);
    set['location.postal_code'] = str(L.postalCode, 20);
    set['location.landmark'] = str(L.landmark, 200);
    set['location.landmark_distance'] = str(L.landmarkDistance, 50);
    const lat = num(L.latitude);
    const lng = num(L.longitude);
    set['location.latitude'] = lat || undefined;
    set['location.longitude'] = lng || undefined;
    set.geometry = lat && lng ? { type: 'Point', coordinates: [lng, lat] } : undefined;
    const M = body.metro || {};
    set['location.is_near_metro'] = !!M.on;
    set['location.metro_stop_landmark'] = M.on ? str(M.name, 200) : '';
    set['location.metro_stop_distance'] = M.on ? str(M.distance, 50) : '';

    set.plans = (Array.isArray(body.plans) ? body.plans : []).slice(0, 50).map((p) => ({
        category: isId(p?.type) ? p.type : OFFICE_SPACE_CATEGORY_ID,
        seat_type: SEAT_KEYS.includes(p?.seatType) ? p.seatType : undefined,
        duration: PLAN_DURATIONS.includes(p?.per) ? p.per : 'month',
        price: num(p?.price) ?? 0,
        number_of_items: 1,
        should_show: p?.show !== false,
        ...(imageId(p?.image) ? { image: imageId(p.image) } : {}),
    }));

    const B = body.building || {};
    set.building = {
        total_floors: num(B.totalFloors),
        super_area: num(B.superArea),
        total_seats: num(B.totalSeats),
        floors: (Array.isArray(B.floors) ? B.floors : [])
            .filter((f) => f && (str(f.floor) || num(f.area) || num(f.seats)))
            .slice(0, 100)
            .map((f) => ({
                floor_number: num(f.floor),
                area: num(f.area),
                seats: num(f.seats),
                ...(imageId(f.plan) ? { floor_plan: imageId(f.plan) } : {}),
            })),
    };
    set.lease_terms = { min_seats: num(body.lease?.minSeats), min_duration_months: num(body.lease?.minMonths) };
    set.rating = {
        source: str(body.rating?.source, 50) || undefined,
        average: num(body.rating?.average),
        total: num(body.rating?.total),
    };

    set.hours_of_operation = hoursForDb(body.hours);
    set.amenties = [...new Set((Array.isArray(body.amenities) ? body.amenities : []).filter(isId))];
    set.images = (Array.isArray(body.photos) ? body.photos : [])
        .map(imageId).filter(Boolean).slice(0, 60).map((image, i) => ({ image, order: i + 1 }));

    for (const [block, val] of Object.entries({ seo: body.seo, new_seo: body.newSeo })) {
        if (!val) continue;
        for (const [k, v] of Object.entries(seoForDb(val))) set[`${block}.${k}`] = v;
    }

    // Priority screens rank offices per city/locality; keep their refs aligned (admin service does the same).
    if (set['location.city']) {
        set['priority.location.city'] = set['location.city'];
        set['priority.micro_location.city'] = set['location.city'];
        if (set['location.micro_location']) set['priority.micro_location.name'] = set['location.micro_location'];
    }

    const unset = {};
    for (const [k, v] of Object.entries(set)) {
        if (v === undefined) {
            delete set[k];
            unset[k] = '';
        }
    }
    return { set, unset };
}

function requireFields(body) {
    const missing = [];
    if (!str(body.name)) missing.push('Office name');
    if (!isId(body.location?.country)) missing.push('Country');
    if (!isId(body.location?.city)) missing.push('City');
    if (missing.length) throw new ApiError(400, `Please fill in: ${missing.join(', ')}`, 'MISSING_FIELDS');
}

async function uniqueSlug(base, exceptId) {
    const root = slugifyText(base) || 'managed-office';
    let slug = root;
    for (let i = 2; await ManagedOffice.exists({ slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }); i++) {
        slug = `${root}-${i}`;
    }
    return slug;
}

function nest(set) {
    const doc = {};
    for (const [path, v] of Object.entries(set)) {
        const parts = path.split('.');
        let o = doc;
        parts.slice(0, -1).forEach((p) => { o = o[p] ??= {}; });
        o[parts[parts.length - 1]] = v;
    }
    return doc;
}

export async function createManagedOffice(body, user) {
    requireFields(body);
    const { set } = await toDbUpdate(body, { isAdmin: canEnableListings(user) });
    const area = set['location.micro_location_string'] || body.labels?.microLocation || set['location.name'] || '';
    const doc = nest(set);
    try {
        // `source.provider + source.id` is a unique index: give our own records their id so two never clash.
        const _id = new Types.ObjectId();
        const created = await ManagedOffice.create({
            _id,
            ...doc,
            geometry: doc.geometry || null,
            slug: await uniqueSlug(`${set.name} ${area}`),
            status: doc.status || 'pending',
            source: { provider: 'spacewallah', id: String(_id) },
            added_by_user: 'admin',
        });
        return String(created._id);
    } catch (err) {
        throw duplicateError(err);
    }
}

export async function updateManagedOffice(id, body, user) {
    requireFields(body);
    const existing = await ManagedOffice.findById(id).select('slug').lean();
    if (!existing) return null;
    const { set, unset } = await toDbUpdate(body, { isAdmin: canEnableListings(user) });
    // Switching an office on or off on the website needs the "enable properties" permission.
    if (!canEnableListings(user)) delete set.is_active;
    const wanted = slugifyText(str(body.slug, 200));
    if (wanted && wanted !== existing.slug) {
        if (await ManagedOffice.exists({ slug: wanted, _id: { $ne: id } })) {
            throw new ApiError(409, 'That web address (slug) is already used by another office.', 'SLUG_TAKEN');
        }
        set.slug = wanted;
    } else if (!existing.slug) {
        set.slug = await uniqueSlug(`${set.name} ${set['location.micro_location_string'] || ''}`, id);
    }
    try {
        await ManagedOffice.updateOne({ _id: id }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
    } catch (err) {
        throw duplicateError(err);
    }
    return String(id);
}
