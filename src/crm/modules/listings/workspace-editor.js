import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { getCountry } from 'country-currency-map';
import models from '../../../models/index.js';
import FileUtility from '../../../utilities/file.js';
import { ApiError } from '../../utils/apiError.js';

/**
 * Add / edit coworking spaces from the CRM apps. Writes the same `WorkSpace` documents the admin panel
 * edits, with the same rules (slug, geometry, currency from country, hours normalisation), so the
 * website shows a space saved here exactly like one saved in the admin panel.
 */
const { WorkSpace, Brand, Country, State, City, MicroLocation, Category, Amenty, Image } = models;

export const SPACE_TAGS = ['Premium', 'Near Metro', 'Special Offer', 'Popular'];
export const PLAN_DURATIONS = ['month', 'year', 'week', 'day', 'hour'];
export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
/** Status keys the apps use ↔ WorkSpace.status. */
const STATUS_TO_DB = { approved: 'approve', pending: 'pending', inprogress: 'inprogress', rejected: 'reject' };
const STATUS_FROM_DB = { approve: 'approved', pending: 'pending', inprogress: 'inprogress', reject: 'rejected' };
/** Nearby transport: flag + landmark name + distance on `location`. */
const NEARBY = [
    { key: 'metro', flag: 'is_near_metro', name: 'landmark', distance: 'landmark_distance' },
    { key: 'bus', flag: 'is_bus_stop', name: 'bus_stop_landmark', distance: 'bus_stop_distance' },
    { key: 'ferry', flag: 'is_ferry_stop', name: 'ferry_stop_landmark', distance: 'ferry_stop_distance' },
    { key: 'taxi', flag: 'is_taxi_stand', name: 'taxi_stand_landmark', distance: 'taxi_stand_distance' },
    { key: 'tram', flag: 'is_tram', name: 'tram_landmark', distance: 'tram_distance' },
];
const SEO_BLOCKS = ['seo', 'new_seo', 'virtualSeo'];

const isId = (v) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);
const idOf = (v) => {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (v instanceof Types.ObjectId) return String(v);
    return v._id ? String(v._id) : '';
};
const str = (v, max = 500) => (v === undefined || v === null ? '' : String(v).trim().slice(0, max));
const num = (v) => {
    if (v === '' || v === null || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
};
const bool = (v) => v === true || v === 'true';
const img = (i) => (i && i.s3_link ? { id: String(i._id), url: i.s3_link, title: i.title || '' } : null);

let optionsCache = null;
/** Dropdown data for the space form (brands, amenities, plan types, countries, tags). */
export async function editorOptions() {
    if (optionsCache && optionsCache.at > Date.now() - 10 * 60e3) return optionsCache.data;
    const [brands, amenities, categories, countries] = await Promise.all([
        Brand.find({ type: 'coworking' }).select('name').sort({ name: 1 }).lean(),
        Amenty.find({ for_coWorking: true }).select('name category').sort({ name: 1 }).lean(),
        Category.find({ active: true }).select('name').sort({ name: 1 }).lean(),
        Country.find({}).select('name for_coWorking').sort({ name: 1 }).lean(),
    ]);
    const opt = (r) => ({ id: String(r._id), name: r.name });
    const data = {
        brands: brands.map(opt),
        amenities: amenities.map((a) => ({ ...opt(a), category: a.category || 'others' })),
        planTypes: categories.map(opt),
        // Coworking countries first (India), then the rest.
        countries: [...countries].sort((a, b) => Number(!!b.for_coWorking) - Number(!!a.for_coWorking)).map(opt),
        spaceTags: SPACE_TAGS,
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

/** States of a country, cities of a state (or country), micro-locations of a city. */
export async function locationOptions({ country, state, city }) {
    const opt = (r) => ({ id: String(r._id), name: r.name });
    const out = {};
    if (isId(country)) {
        out.states = (await State.find({ country }).select('name').sort({ name: 1 }).lean()).map(opt);
        const cityQ = isId(state) ? { state } : { country };
        out.cities = (await City.find(cityQ).select('name').sort({ name: 1 }).lean()).map(opt);
    }
    if (isId(city)) {
        out.microLocations = (await MicroLocation.find({ city }).select('name').sort({ name: 1 }).lean()).map(opt);
    }
    return out;
}

function hoursForForm(h = {}) {
    const out = {};
    for (const day of WEEKDAYS) {
        const r = h?.[day] || {};
        out[day] = {
            open: r.should_show !== undefined ? !!r.should_show && !r.is_closed : day === 'monday',
            allDay: !!r.is_open_24,
            from: r.from || '09:00 AM',
            to: r.to || '08:00 PM',
        };
    }
    return out;
}

function seoForForm(s = {}) {
    return {
        title: s.title || '',
        description: s.description || '',
        keywords: s.keywords || '',
        index: s.robots ? s.robots === 'index, follow' : true,
        twitterTitle: s.twitter?.title || '',
        twitterDescription: s.twitter?.description || '',
        twitterImage: img(s.twitter?.image),
        ogTitle: s.open_graph?.title || '',
        ogDescription: s.open_graph?.description || '',
        ogImage: img(s.open_graph?.image),
    };
}

/** A WorkSpace as the edit form's flat-ish shape (ids as strings, photos as {id, url, title}). */
function toEditable(d) {
    const loc = d.location || {};
    const nearby = {};
    for (const n of NEARBY) {
        nearby[n.key] = { on: !!loc[n.flag], name: loc[n.name] || '', distance: loc[n.distance] || '' };
    }
    const labels = {
        brand: d.brand?.name || '',
        country: loc.country?.name || '',
        state: loc.state?.name || '',
        city: loc.city?.name || '',
        microLocation: loc.micro_location?.name || '',
    };
    return {
        id: String(d._id),
        name: d.name || '',
        slug: d.slug || '',
        status: STATUS_FROM_DB[d.status] || 'pending',
        isActive: d.is_active !== false,
        spaceTag: d.spaceTag || '',
        brand: idOf(d.brand),
        seats: d.no_of_seats ?? '',
        startingPrice: d.starting_price ?? '',
        rating: d.ratings || '',
        currency: d.currency_code || '',
        smallTeam: !!d.small_team_availability,
        enterprise: !!d.enterprise_availability,
        email: d.email || '',
        website: d.website_Url || '',
        description: d.description || '',
        newDescription: d.new_description || '',
        location: {
            country: idOf(loc.country),
            state: idOf(loc.state),
            city: idOf(loc.city),
            microLocation: idOf(loc.micro_location),
            name: loc.name || '',
            buildingName: loc.name1 || '',
            address: loc.address1 || loc.address || '',
            floor: loc.floor || '',
            postalCode: loc.postal_code || '',
            latitude: loc.latitude ?? '',
            longitude: loc.longitude ?? '',
        },
        nearby,
        hours: hoursForForm(d.hours_of_operation),
        plans: (d.plans || []).map((p) => ({
            type: idOf(p.category),
            price: p.price ?? '',
            per: p.duration || 'month',
            show: p.should_show !== false,
            image: img(p.image),
        })),
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
        contacts: (d.contact_details || []).map((c) => ({
            designation: c.designation || '',
            name: c.name || '',
            phone: c.phone_number || '',
        })),
        social: {
            facebook: d.social_media?.facebook || '',
            twitter: d.social_media?.twitter || '',
            instagram: d.social_media?.instagram || '',
        },
        seo: seoForForm(d.seo),
        newSeo: seoForForm(d.new_seo),
        virtualSeo: seoForForm(d.virtualSeo),
        labels,
    };
}

const EDIT_POPULATE = [
    { path: 'brand', select: 'name' },
    { path: 'location.country', select: 'name' },
    { path: 'location.state', select: 'name' },
    { path: 'location.city', select: 'name' },
    { path: 'location.micro_location', select: 'name' },
    { path: 'images.image', select: 's3_link title' },
    { path: 'plans.image', select: 's3_link title' },
    ...SEO_BLOCKS.flatMap((b) => [
        { path: `${b}.twitter.image`, select: 's3_link title' },
        { path: `${b}.open_graph.image`, select: 's3_link title' },
    ]),
];

export async function getEditable(id) {
    if (!isId(String(id))) return null;
    const d = await WorkSpace.findById(id).populate(EDIT_POPULATE).lean();
    return d ? toEditable(d) : null;
}

/** City name of a form's city id, for the CRM city-scope check. */
export async function cityNameOf(cityId) {
    if (!isId(cityId)) return '';
    const c = await City.findById(cityId).select('name').lean();
    return c?.name || '';
}

function slugify(s) {
    return String(s).toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

/** Same rule as the admin service: "<name> <location name>", random suffix when taken. */
async function uniqueSlug(base, exceptId) {
    let slug = slugify(base) || `space-${crypto.randomBytes(3).toString('hex')}`;
    const clash = await WorkSpace.exists({ slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
    if (clash) slug = `${slug}-${crypto.randomBytes(2).toString('hex')}`;
    return slug;
}

function hoursForDb(h = {}) {
    const out = {};
    for (const day of WEEKDAYS) {
        const r = h?.[day] || {};
        const open = !!r.open;
        const allDay = open && !!r.allDay;
        out[day] = {
            should_show: open,
            is_closed: !open,
            is_open_24: allDay,
            from: !open ? '' : allDay ? '12:00 AM' : str(r.from, 20) || '09:00 AM',
            to: !open ? '' : allDay ? '12:00 PM' : str(r.to, 20) || '08:00 PM',
        };
    }
    return out;
}

const imageId = (i) => (i && isId(String(i.id || '')) ? String(i.id) : undefined);

function seoForDb(s = {}) {
    return {
        title: str(s.title, 300),
        description: str(s.description, 2000),
        keywords: str(s.keywords, 1000),
        robots: s.index === false ? 'noindex, nofollow' : 'index, follow',
        'twitter.title': str(s.twitterTitle, 300),
        'twitter.description': str(s.twitterDescription, 2000),
        'twitter.image': imageId(s.twitterImage) || null,
        'open_graph.title': str(s.ogTitle, 300),
        'open_graph.description': str(s.ogDescription, 2000),
        'open_graph.image': imageId(s.ogImage) || null,
    };
}

/**
 * Form body → { set } of dotted WorkSpace paths. Nested objects (location, SEO) are set field by field so
 * values the form doesn't show (hospital landmarks, SEO url, …) are kept.
 */
async function toDbUpdate(body, { isAdmin }) {
    const set = {};
    const put = (k, v) => { if (v !== undefined) set[k] = v; };

    put('name', str(body.name, 200));
    put('spaceTag', SPACE_TAGS.includes(body.spaceTag) ? body.spaceTag : undefined);
    if (isId(body.brand)) set.brand = body.brand;
    put('no_of_seats', num(body.seats) ?? 0);
    put('starting_price', num(body.startingPrice) ?? 0);
    put('ratings', str(body.rating, 10));
    put('small_team_availability', bool(body.smallTeam));
    put('enterprise_availability', bool(body.enterprise));
    put('is_active', body.isActive !== false);
    put('email', str(body.email, 200));
    put('website_Url', str(body.website, 500));
    put('description', String(body.description ?? '').slice(0, 50000));
    put('new_description', String(body.newDescription ?? '').slice(0, 50000));
    if (isAdmin && STATUS_TO_DB[body.status]) set.status = STATUS_TO_DB[body.status];

    const L = body.location || {};
    for (const k of ['country', 'state', 'city']) {
        set[`location.${k}`] = isId(L[k]) ? L[k] : undefined;
    }
    set['location.micro_location'] = isId(L.microLocation) ? L.microLocation : undefined;
    put('location.name', str(L.name, 200));
    put('location.name1', str(L.buildingName, 200));
    put('location.address1', str(L.address, 500));
    put('location.floor', str(L.floor, 100));
    put('location.postal_code', str(L.postalCode, 20));
    const lat = num(L.latitude);
    const lng = num(L.longitude);
    set['location.latitude'] = lat || undefined;
    set['location.longitude'] = lng || undefined;
    set.geometry = lat && lng ? { type: 'Point', coordinates: [lng, lat] } : undefined;

    const N = body.nearby || {};
    for (const n of NEARBY) {
        const r = N[n.key] || {};
        const on = !!r.on;
        set[`location.${n.flag}`] = on;
        set[`location.${n.name}`] = on ? str(r.name, 200) : '';
        set[`location.${n.distance}`] = on ? str(r.distance, 50) : '';
    }

    set.hours_of_operation = hoursForDb(body.hours);

    set.plans = (Array.isArray(body.plans) ? body.plans : [])
        .filter((p) => isId(p?.type))
        .slice(0, 50)
        .map((p) => ({
            category: p.type,
            price: num(p.price) ?? 0,
            duration: PLAN_DURATIONS.includes(p.per) ? p.per : 'month',
            should_show: p.show !== false,
            number_of_items: 1,
            ...(imageId(p.image) ? { image: imageId(p.image) } : {}),
        }));

    set.amenties = [...new Set((Array.isArray(body.amenities) ? body.amenities : []).filter(isId))];

    set.images = (Array.isArray(body.photos) ? body.photos : [])
        .map(imageId)
        .filter(Boolean)
        .slice(0, 60)
        .map((image, i) => ({ image, order: i + 1 }));

    const SC = body.spaceContact || {};
    set.space_contact_details = {
        name: str(SC.name, 200),
        email: str(SC.email, 200),
        phone: str(SC.phone, 40),
        show_on_website: !!SC.showOnWebsite,
    };
    set.contact_details = (Array.isArray(body.contacts) ? body.contacts : [])
        .filter((c) => c && (str(c.name) || str(c.phone)))
        .slice(0, 20)
        .map((c) => ({ designation: str(c.designation, 100), name: str(c.name, 200), phone_number: str(c.phone, 40) }));

    const S = body.social || {};
    for (const k of ['facebook', 'twitter', 'instagram']) set[`social_media.${k}`] = str(S[k], 500);

    const seoMap = { seo: body.seo, new_seo: body.newSeo, virtualSeo: body.virtualSeo };
    for (const [block, val] of Object.entries(seoMap)) {
        if (!val) continue;
        for (const [k, v] of Object.entries(seoForDb(val))) set[`${block}.${k}`] = v;
    }

    // Currency + country name follow the country, as in the admin panel.
    if (isId(L.country)) {
        const c = await Country.findById(L.country).select('name').lean();
        if (c) {
            set.country_dbname = c.name;
            set.currency_code = getCountry(c.name)?.currency || 'INR';
        }
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
    if (!str(body.name)) missing.push('Space name');
    if (!isId(body.brand)) missing.push('Brand');
    if (!SPACE_TAGS.includes(body.spaceTag)) missing.push('Space tag');
    if (!isId(body.location?.country)) missing.push('Country');
    if (!isId(body.location?.city)) missing.push('City');
    if (missing.length) {
        throw new ApiError(400, `Please fill in: ${missing.join(', ')}`, 'MISSING_FIELDS');
    }
}

function duplicateError(err) {
    if (err?.code === 11000) {
        return new ApiError(409, 'A space with this name and address already exists.', 'DUPLICATE_SPACE');
    }
    return err;
}

export async function createWorkspace(body, user) {
    requireFields(body);
    const isAdmin = user?.role === 'admin';
    const { set } = await toDbUpdate(body, { isAdmin });
    const expireAt = new Date();
    expireAt.setMonth(expireAt.getMonth() + 3);
    const slug = await uniqueSlug(`${set.name} ${set['location.name'] || ''}`);

    // Dotted paths → nested object for create.
    const doc = {};
    for (const [path, v] of Object.entries(set)) {
        const parts = path.split('.');
        let o = doc;
        parts.slice(0, -1).forEach((p) => { o = o[p] ??= {}; });
        o[parts[parts.length - 1]] = v;
    }
    try {
        const created = await WorkSpace.create({
            ...doc,
            // No coordinates → no point at all; the schema default `{ type: 'Point' }` breaks the 2dsphere index.
            geometry: doc.geometry || null,
            slug,
            status: doc.status || 'pending',
            added_by_user: 'admin',
            space_type_key: 'coworking',
            expireAt,
        });
        return String(created._id);
    } catch (err) {
        throw duplicateError(err);
    }
}

export async function updateWorkspace(id, body, user) {
    requireFields(body);
    const isAdmin = user?.role === 'admin';
    const existing = await WorkSpace.findById(id).select('slug location.name status').lean();
    if (!existing) return null;
    const { set, unset } = await toDbUpdate(body, { isAdmin });

    const wanted = slugify(str(body.slug, 200));
    if (wanted && wanted !== existing.slug) {
        if (await WorkSpace.exists({ slug: wanted, _id: { $ne: id } })) {
            throw new ApiError(409, 'That web address (slug) is already used by another space.', 'SLUG_TAKEN');
        }
        set.slug = wanted;
    } else if (!existing.slug) {
        set.slug = await uniqueSlug(`${set.name} ${set['location.name'] || ''}`, id);
    }

    // Rejecting takes the space out of every priority list (same as the admin status switch).
    if (set.status === 'reject' && existing.status !== 'reject') {
        Object.assign(set, {
            'priority.overall.is_active': false,
            'priority.overall.order': 1000,
            'priority.location.is_active': false,
            'priority.location.order': 1000,
            'priority.micro_location.is_active': false,
            'priority.micro_location.order': 1000,
            'virtual_priority.location.is_active': false,
            'virtual_priority.location.order': 1000,
        });
    }

    try {
        await WorkSpace.updateOne({ _id: id }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
    } catch (err) {
        throw duplicateError(err);
    }
    return String(id);
}

/** Uploads phone photos the way the admin panel does (webp, 1000×550 + small copy) and records Image docs. */
export async function uploadWorkspaceImages(files = []) {
    const out = [];
    for (const file of files) {
        const name = crypto.randomBytes(20).toString('hex');
        const fileLike = { name: file.originalname || 'photo.jpg', size: file.size, data: file.buffer };
        const details = await FileUtility.saveFile({ file: fileLike }, 'image', name, 'images', true, 1000, 550, 1, 1);
        await FileUtility.saveFile({ file: { ...fileLike, data: file.buffer } }, 'image', name, 'small/images/latest_images_2024', true, 497, 280, 1, 1);
        const [saved] = await Image.insertMany([details]);
        out.push({ id: String(saved._id), url: saved.s3_link, title: '' });
    }
    return out;
}

/** Photo captions (alt text) are stored on the Image docs, as in the admin gallery. */
export async function saveImageTitles(photos = []) {
    const ops = (Array.isArray(photos) ? photos : [])
        .filter((p) => imageId(p) && typeof p.title === 'string')
        .map((p) => ({ updateOne: { filter: { _id: p.id }, update: { $set: { title: str(p.title, 200) } } } }));
    if (ops.length) await Image.bulkWrite(ops, { ordered: false });
}
