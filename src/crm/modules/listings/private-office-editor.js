import models from '../../../models/index.js';
import { slugifyText } from '../../../utilities/pg-slug.js';
import { ApiError } from '../../utils/apiError.js';
import { OFFICE_TYPES } from './private-office-listings.js';
import {
    STATUS_FROM_DB, STATUS_TO_DB, duplicateError, idOf, img, imageId, isId, num, seoForDb, seoForForm, str,
} from './workspace-editor.js';

/**
 * Add / edit private offices (offices for lease, `OfficeSpace` collection) from the CRM apps, with the same
 * fields as the admin panel's office space form: furnishing, area, rent per sq ft, monthly rent, floor,
 * maintenance, security deposit, facilities, location with metro, amenities, photos, contacts and SEO.
 */
const { OfficeSpace, Builder, Country, State, Amenty } = models;

export const OFFICE_TYPE_OPTIONS = Object.entries(OFFICE_TYPES).map(([key, label]) => ({ key, label }));

let optionsCache = null;
export async function privateOfficeEditorOptions() {
    if (optionsCache && optionsCache.at > Date.now() - 10 * 60e3) return optionsCache.data;
    const [builders, amenities, countries] = await Promise.all([
        Builder.find({}).select('name').sort({ name: 1 }).collation({ locale: 'en', strength: 2 }).lean(),
        Amenty.find({ for_office: true }).select('name category').sort({ name: 1 }).lean(),
        Country.find({}).select('name for_office').sort({ name: 1 }).lean(),
    ]);
    const opt = (r) => ({ id: String(r._id), name: r.name });
    const data = {
        vertical: 'private-office',
        brands: builders.map(opt),
        amenities: amenities.map((a) => ({ ...opt(a), category: a.category || 'others' })),
        countries: [...countries].sort((a, b) => Number(!!b.for_office) - Number(!!a.for_office)).map(opt),
        officeTypes: OFFICE_TYPE_OPTIONS,
        facilityNames: ['Workstations', 'Cabins', 'Conference room', 'Meeting room', 'Reception', 'Pantry', 'Washrooms', 'Server room', 'Parking'],
        planTypes: [],
        spaceTags: [],
        durations: [],
        statuses: [
            { key: 'pending', label: 'Pending' },
            { key: 'inprogress', label: 'In progress' },
            { key: 'approved', label: 'Approved' },
            { key: 'rejected', label: 'Rejected' },
        ],
    };
    optionsCache = { at: Date.now(), data };
    return data;
}

const EDIT_POPULATE = [
    { path: 'builder', select: 'name' },
    { path: 'location.country', select: 'name' },
    { path: 'location.state', select: 'name' },
    { path: 'location.city', select: 'name' },
    { path: 'location.micro_location', select: 'name' },
    { path: 'images.image', select: 's3_link title' },
    { path: 'seo.twitter.image', select: 's3_link title' },
    { path: 'seo.open_graph.image', select: 's3_link title' },
];

/** `location.country` / `state` are stored as ids or (older records) plain text; only ids go in the form. */
const refId = (v) => {
    const id = idOf(v);
    return isId(id) ? id : '';
};

function toEditable(d) {
    const loc = d.location || {};
    const o = d.other_detail || {};
    const blank = (v) => (v === undefined || v === null ? '' : v);
    const micro = (Array.isArray(loc.micro_location) ? loc.micro_location : [loc.micro_location]).filter(Boolean)[0];
    return {
        id: String(d._id),
        vertical: 'private-office',
        name: d.name || '',
        slug: d.slug || '',
        status: STATUS_FROM_DB[d.status] || 'pending',
        isActive: d.is_active !== false,
        brand: refId(d.builder),
        officeType: OFFICE_TYPES[o.office_type] ? o.office_type : 'fully-furnished',
        areaSqft: blank(o.area_for_lease_in_sq_ft),
        rentPerSqft: blank(o.rent_in_sq_ft),
        monthlyRent: blank(o.monthly_rent),
        officeFloor: o.floor || '',
        maintenance: { on: /^y/i.test(o.monthly_maintenance || ''), amount: o.monthly_maintenance_amount || '' },
        securityDeposit: o.security_deposit || '',
        facilities: (o.facilities || [])
            .filter((f) => f && (String(f.name || '').trim() || String(f.value || '').trim()))
            .map((f) => ({ name: f.name || '', value: String(f.value ?? '') })),
        howToReach: o.how_to_reach || '',
        sundayOpen: !!d.hours_of_operation?.is_sunday_open,
        open24: !!d.hours_of_operation?.is_open_24,
        description: d.description || '',
        location: {
            country: refId(loc.country),
            state: refId(loc.state),
            city: refId(loc.city),
            microLocation: refId(micro),
            areaText: loc.micro_location_string || '',
            name: loc.name || '',
            buildingName: o.building_name || loc.name || '',
            address: loc.address || '',
            floor: loc.floor || '',
            postalCode: loc.postal_code || '',
            landmark: loc.landmark || '',
            landmarkDistance: loc.landmark_distance || '',
            latitude: blank(loc.latitude),
            longitude: blank(loc.longitude),
        },
        metro: {
            on: !!loc.metro_detail?.is_near_metro,
            name: loc.metro_detail?.name || '',
            distance: loc.metro_detail?.distance != null ? String(loc.metro_detail.distance) : '',
        },
        amenities: (d.amenties || []).map(idOf).filter(Boolean),
        photos: [...(d.images || [])]
            .sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
            .map((i) => img(i?.image))
            .filter(Boolean),
        spaceContact: {
            name: d.space_contact_details?.name || '',
            email: d.space_contact_details?.email || '',
            phone: d.space_contact_details?.phone || '',
            showOnWebsite: !!d.space_contact_details?.show_on_website,
        },
        contacts: (d.contact_details || []).map((c) => ({ designation: c.designation || '', name: c.name || '', phone: c.phone_number || '' })),
        seo: seoForForm(d.seo),
        labels: {
            brand: d.builder?.name || '',
            country: loc.country?.name || '',
            state: loc.state?.name || '',
            city: loc.city?.name || '',
            microLocation: micro?.name || '',
        },
    };
}

export async function getPrivateOfficeEditable(id) {
    if (!isId(String(id))) return null;
    const d = await OfficeSpace.findById(id).populate(EDIT_POPULATE).lean();
    if (!d) return null;
    const out = toEditable(d);
    // Country and state are stored as plain id strings on offices, so their names are looked up here.
    const [country, state] = await Promise.all([
        out.location.country && !out.labels.country ? Country.findById(out.location.country).select('name').lean() : null,
        out.location.state && !out.labels.state ? State.findById(out.location.state).select('name').lean() : null,
    ]);
    if (country) out.labels.country = country.name;
    if (state) out.labels.state = state.name;
    return out;
}

/** Form body → dotted OfficeSpace paths. `canEnable`: may set the status and switch the office on or off. */
function toDbUpdate(body, { canEnable }) {
    const set = {};
    set.name = str(body.name, 300);
    set.builder = isId(body.brand) ? body.brand : undefined;
    set.description = String(body.description ?? '').slice(0, 50000);
    if (canEnable) {
        set.is_active = body.isActive !== false;
        if (STATUS_TO_DB[body.status]) set.status = STATUS_TO_DB[body.status];
    }

    const L = body.location || {};
    for (const k of ['country', 'state', 'city']) set[`location.${k}`] = isId(L[k]) ? L[k] : undefined;
    set['location.micro_location'] = isId(L.microLocation) ? [L.microLocation] : [];
    set['location.micro_location_string'] = str(L.areaText, 200);
    const building = str(L.buildingName, 200);
    set['location.name'] = building || str(L.name, 200);
    set['location.address'] = str(L.address, 500);
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
    set['location.metro_detail.is_near_metro'] = !!M.on;
    set['location.metro_detail.name'] = M.on ? str(M.name, 200) : '';
    set['location.metro_detail.distance'] = M.on ? num(String(M.distance || '').replace(/[^\d.]/g, '')) ?? undefined : undefined;

    set['other_detail.building_name'] = building;
    set['other_detail.office_type'] = OFFICE_TYPES[body.officeType] ? body.officeType : 'fully-furnished';
    set['other_detail.area_for_lease_in_sq_ft'] = num(body.areaSqft);
    set['other_detail.rent_in_sq_ft'] = num(body.rentPerSqft);
    const rent = num(body.monthlyRent) || (num(body.areaSqft) && num(body.rentPerSqft) ? Math.round(num(body.areaSqft) * num(body.rentPerSqft)) : undefined);
    set['other_detail.monthly_rent'] = rent;
    set['other_detail.floor'] = str(body.officeFloor, 100);
    set['other_detail.monthly_maintenance'] = body.maintenance?.on ? 'Yes' : 'No';
    set['other_detail.monthly_maintenance_amount'] = body.maintenance?.on ? str(body.maintenance.amount, 50) : '';
    set['other_detail.security_deposit'] = str(body.securityDeposit, 100);
    set['other_detail.how_to_reach'] = str(body.howToReach, 1000);
    set['other_detail.facilities'] = (Array.isArray(body.facilities) ? body.facilities : [])
        .filter((f) => f && str(f.name))
        .slice(0, 40)
        .map((f) => ({ name: str(f.name, 100), value: str(f.value, 100) }));

    set['hours_of_operation.is_sunday_open'] = !!body.sundayOpen;
    set['hours_of_operation.is_open_24'] = !!body.open24;
    set.amenties = [...new Set((Array.isArray(body.amenities) ? body.amenities : []).filter(isId))];
    set.images = (Array.isArray(body.photos) ? body.photos : [])
        .map(imageId).filter(Boolean).slice(0, 60).map((image, i) => ({ image, order: i + 1 }));

    const SC = body.spaceContact || {};
    set.space_contact_details = {
        name: str(SC.name, 200), email: str(SC.email, 200), phone: str(SC.phone, 40), show_on_website: !!SC.showOnWebsite,
    };
    set.contact_details = (Array.isArray(body.contacts) ? body.contacts : [])
        .filter((c) => c && (str(c.name) || str(c.phone)))
        .slice(0, 20)
        .map((c) => ({ designation: str(c.designation, 100), name: str(c.name, 200), phone_number: str(c.phone, 40) }));
    if (body.seo) for (const [k, v] of Object.entries(seoForDb(body.seo))) set[`seo.${k}`] = v;

    if (set['location.city']) {
        set['priority.location.city'] = set['location.city'];
        set['priority.micro_location.city'] = set['location.city'];
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
    const root = slugifyText(base) || 'private-office';
    let slug = root;
    for (let i = 2; await OfficeSpace.exists({ slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }); i++) {
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

export async function createPrivateOffice(body, user, { canEnable = false } = {}) {
    requireFields(body);
    const { set } = toDbUpdate(body, { canEnable });
    const area = set['location.micro_location_string'] || body.labels?.microLocation || set['location.name'] || '';
    const doc = nest(set);
    const year = new Date().getFullYear();
    const count = await OfficeSpace.estimatedDocumentCount();
    try {
        const created = await OfficeSpace.create({
            ...doc,
            geometry: doc.geometry || null,
            slug: await uniqueSlug(`${set.name} ${area}`),
            status: doc.status || 'pending',
            productId: `SWPO${year}${String(count + 1).padStart(5, '0')}`,
            added_by_user: 'admin',
            space_type_key: 'office-space/rent',
        });
        return String(created._id);
    } catch (err) {
        throw duplicateError(err);
    }
}

export async function updatePrivateOffice(id, body, user, { canEnable = false } = {}) {
    requireFields(body);
    const existing = await OfficeSpace.findById(id).select('slug').lean();
    if (!existing) return null;
    const { set, unset } = toDbUpdate(body, { canEnable });
    const wanted = slugifyText(str(body.slug, 200));
    if (wanted && wanted !== existing.slug) {
        if (await OfficeSpace.exists({ slug: wanted, _id: { $ne: id } })) {
            throw new ApiError(409, 'That web address (slug) is already used by another office.', 'SLUG_TAKEN');
        }
        set.slug = wanted;
    } else if (!existing.slug) {
        set.slug = await uniqueSlug(`${set.name} ${set['location.micro_location_string'] || ''}`, id);
    }
    try {
        await OfficeSpace.updateOne({ _id: id }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
    } catch (err) {
        throw duplicateError(err);
    }
    return String(id);
}
