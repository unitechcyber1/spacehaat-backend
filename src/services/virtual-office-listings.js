import mongoose from 'mongoose';
import models from '../models/index.js';
import { slugifyText } from '../utilities/pg-slug.js';

const { VirtualOfficeListing, City } = models;

/** Error with an HTTP status; the admin controller and the CRM error middleware both read `status`. */
export class VoError extends Error {
    constructor(status, message, code = 'VO_ERROR') {
        super(message);
        this.status = status;
        this.code = code;
    }
}

export const VO_TIERS = ['Tier 1', 'Tier 2', 'Tier 3'];
export const VO_STATUSES = ['Active', 'Inactive'];

const EDITABLE = [
    'spaceName', 'city', 'state', 'locality', 'fullAddress', 'phoneNumber', 'status',
    'annualPriceInr', 'sellingPriceInr', 'cityTier', 'amenities', 'contactNotes', 'remarks',
    'lastUpdatedLabel', 'couponCode', 'couponPercentage', 'images',
];
const NUMBERS = new Set(['annualPriceInr', 'sellingPriceInr', 'couponPercentage']);
const SORTABLE = new Set(['spaceName', 'city', 'locality', 'annualPriceInr', 'sellingPriceInr', 'status', 'cityTier', 'added_on', 'updated_on']);

/** Same-city spellings, so a Gurugram filter or city scope also finds "Gurgaon". */
const CITY_ALIASES = {
    gurgaon: ['gurgaon', 'gurugram'],
    gurugram: ['gurugram', 'gurgaon'],
    bangalore: ['bangalore', 'bengaluru'],
    bengaluru: ['bengaluru', 'bangalore'],
    delhi: ['delhi', 'new delhi'],
    'new delhi': ['new delhi', 'delhi'],
    trivandrum: ['trivandrum', 'thiruvananthapuram'],
    calicut: ['calicut', 'kozhikode'],
    mysore: ['mysore', 'mysuru'],
};

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const aliases = (name) => {
    const key = String(name || '').trim().toLowerCase();
    return CITY_ALIASES[key] || [key];
};
const cityMatcher = (names) => ({
    $in: [...new Set(names.flatMap(aliases))].filter(Boolean).map((n) => new RegExp(`^${escapeRe(n)}$`, 'i')),
});

function toNumber(value, field) {
    if (value === '' || value === null || value === undefined) return 0;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) throw new VoError(400, `${field} must be a number of 0 or more`, 'INVALID_NUMBER');
    return Math.round(n);
}

function cleanImages(images) {
    if (!Array.isArray(images)) return [];
    return images
        .map((img, i) => {
            const url = typeof img === 'string' ? img : img?.url || img?.s3_link || '';
            if (!url || !/^https?:\/\//i.test(url)) return null;
            return { url: String(url).trim(), name: String(img?.name || img?.real_name || '').trim(), order: i + 1 };
        })
        .filter(Boolean)
        .slice(0, 20);
}

/** Pick, trim and check the fields a create / edit may set. */
function cleanInput(input = {}, { partial = false } = {}) {
    const out = {};
    for (const key of EDITABLE) {
        if (input[key] === undefined) continue;
        if (key === 'images') out.images = cleanImages(input.images);
        else if (NUMBERS.has(key)) out[key] = toNumber(input[key], key);
        else out[key] = String(input[key] ?? '').trim();
    }
    if (out.status !== undefined) {
        const s = VO_STATUSES.find((v) => v.toLowerCase() === out.status.toLowerCase());
        if (!s) throw new VoError(400, 'Status must be Active or Inactive', 'INVALID_STATUS');
        out.status = s;
    }
    if (out.couponCode !== undefined) out.couponCode = out.couponCode.toUpperCase().replace(/\s+/g, '');
    if (!partial || out.spaceName !== undefined) {
        if (!out.spaceName) throw new VoError(400, 'Space name is required', 'NAME_REQUIRED');
    }
    if (!partial || out.city !== undefined) {
        if (!out.city) throw new VoError(400, 'City is required', 'CITY_REQUIRED');
    }
    if (out.couponPercentage !== undefined && out.couponPercentage > 100) {
        throw new VoError(400, 'Coupon discount cannot be more than 100%', 'INVALID_COUPON');
    }
    return out;
}

function checkCoupon(doc) {
    const code = String(doc.couponCode || '').trim();
    const pct = Number(doc.couponPercentage) || 0;
    if (code && pct <= 0) throw new VoError(400, 'Enter a discount above 0% for the coupon code', 'INVALID_COUPON');
    if (!code && pct > 0) throw new VoError(400, 'Enter a coupon code for the discount', 'INVALID_COUPON');
}

async function resolveCityId(city) {
    if (!city) return null;
    const row = await City.findOne({ name: cityMatcher([city]) }).select('_id').lean();
    return row?._id || null;
}

async function uniqueSlug(doc, excludeId) {
    const base = slugifyText([doc.spaceName, doc.locality, doc.city].filter(Boolean).join(' ')) || 'virtual-office';
    let slug = base;
    for (let n = 2; n < 200; n++) {
        const clash = await VirtualOfficeListing.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
        if (!clash) return slug;
        slug = `${base}-${n}`;
    }
    return `${base}-${Date.now()}`;
}

/** API shape. `withCost: false` leaves out what the operator charges us (members don't see it). */
export function serializeVo(doc, { withCost = true } = {}) {
    if (!doc) return null;
    const images = [...(doc.images || [])].sort((a, b) => (a.order || 0) - (b.order || 0)).map((img) => ({ url: img.url, name: img.name || '' }));
    const selling = doc.sellingPriceInr || 0;
    const pct = doc.couponCode ? doc.couponPercentage || 0 : 0;
    const out = {
        id: String(doc._id),
        spaceName: doc.spaceName,
        slug: doc.slug || '',
        city: doc.city,
        state: doc.state || '',
        locality: doc.locality || '',
        fullAddress: doc.fullAddress || '',
        phoneNumber: doc.phoneNumber || '',
        status: doc.status || 'Active',
        isActive: doc.isActive !== false,
        sellingPriceInr: selling,
        sellingMonthlyPriceInr: doc.sellingMonthlyPriceInr || 0,
        priceAfterCouponInr: pct ? Math.round(selling * (1 - pct / 100)) : selling,
        cityTier: doc.cityTier || '',
        amenities: doc.amenities || '',
        amenityList: String(doc.amenities || '').split(',').map((s) => s.trim()).filter(Boolean),
        contactNotes: doc.contactNotes || '',
        remarks: doc.remarks || '',
        lastUpdatedLabel: doc.lastUpdatedLabel || '',
        couponCode: doc.couponCode || '',
        couponPercentage: pct,
        images,
        added_on: doc.added_on,
        updated_on: doc.updated_on,
    };
    if (withCost) {
        out.annualPriceInr = doc.annualPriceInr || 0;
        out.monthlyPriceInr = doc.monthlyPriceInr || 0;
        out.marginInr = selling && doc.annualPriceInr ? selling - doc.annualPriceInr : null;
    }
    return out;
}

/**
 * Filters: search, city, status (Active|Inactive), cityTier, hasCoupon (yes|no), minPrice / maxPrice
 * (selling, per year), sortBy / orderBy, page / limit. `allowedCities` (array) limits the result
 * to those cities; null means every city.
 */
export async function listVirtualOffices(filters = {}, { allowedCities = null, withCost = true } = {}) {
    const and = [];
    const city = filters.city && filters.city !== 'All cities' ? String(filters.city) : '';
    if (Array.isArray(allowedCities)) {
        if (!allowedCities.length) return emptyPage(filters);
        const allowed = new Set(allowedCities.flatMap(aliases));
        if (city && !aliases(city).some((a) => allowed.has(a))) return emptyPage(filters);
        and.push({ city: cityMatcher(city ? [city] : allowedCities) });
    } else if (city) {
        and.push({ city: cityMatcher([city]) });
    }

    const status = String(filters.status || '').toLowerCase();
    if (status === 'active' || status === 'inactive') and.push({ isActive: status === 'active' });
    if (filters.cityTier) and.push({ cityTier: String(filters.cityTier) });
    if (filters.hasCoupon === 'yes') and.push({ couponCode: { $nin: ['', null] } });
    if (filters.hasCoupon === 'no') and.push({ couponCode: { $in: ['', null] } });

    const price = {};
    if (filters.minPrice !== undefined && filters.minPrice !== '' && Number.isFinite(Number(filters.minPrice))) price.$gte = Number(filters.minPrice);
    if (filters.maxPrice !== undefined && filters.maxPrice !== '' && Number.isFinite(Number(filters.maxPrice))) price.$lte = Number(filters.maxPrice);
    if (Object.keys(price).length) and.push({ sellingPriceInr: price });

    const search = String(filters.search || '').trim();
    if (search) {
        const re = new RegExp(escapeRe(search.slice(0, 80)), 'i');
        and.push({ $or: [{ spaceName: re }, { locality: re }, { city: re }, { fullAddress: re }, { amenities: re }, { phoneNumber: re }] });
    }

    const query = and.length ? { $and: and } : {};
    const limit = Math.min(200, Math.max(1, Number(filters.limit) || 20));
    const page = Math.max(1, Number(filters.page) || 1);
    const sortBy = SORTABLE.has(filters.sortBy) && (withCost || filters.sortBy !== 'annualPriceInr') ? filters.sortBy : null;
    const dir = String(filters.orderBy) === '-1' ? -1 : 1;
    const sort = sortBy ? { [sortBy]: dir, _id: 1 } : { isActive: -1, city: 1, spaceName: 1 };

    const [rows, total] = await Promise.all([
        VirtualOfficeListing.find(query).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
        VirtualOfficeListing.countDocuments(query),
    ]);
    return {
        items: rows.map((r) => serializeVo(r, { withCost })),
        total,
        page,
        limit,
        pageCount: Math.max(1, Math.ceil(total / limit)),
    };
}

function emptyPage(filters) {
    const limit = Math.min(200, Math.max(1, Number(filters.limit) || 20));
    return { items: [], total: 0, page: 1, limit, pageCount: 1 };
}

/** Totals plus the city list (with counts) for filters. */
export async function virtualOfficeStats({ allowedCities = null } = {}) {
    const match = Array.isArray(allowedCities) ? { city: cityMatcher(allowedCities.length ? allowedCities : ['__none__']) } : {};
    const [totals] = await VirtualOfficeListing.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                active: { $sum: { $cond: ['$isActive', 1, 0] } },
                withCoupon: { $sum: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$couponCode', ''] } }, 0] }, 1, 0] } },
                minPrice: { $min: { $cond: [{ $gt: ['$sellingPriceInr', 0] }, '$sellingPriceInr', null] } },
                maxPrice: { $max: '$sellingPriceInr' },
                noPrice: { $sum: { $cond: [{ $gt: ['$sellingPriceInr', 0] }, 0, 1] } },
            },
        },
    ]);
    const cities = await VirtualOfficeListing.aggregate([
        { $match: match },
        { $group: { _id: '$city', total: { $sum: 1 }, active: { $sum: { $cond: ['$isActive', 1, 0] } } } },
        { $sort: { total: -1, _id: 1 } },
    ]);
    const t = totals || { total: 0, active: 0, withCoupon: 0, minPrice: 0, maxPrice: 0, noPrice: 0 };
    return {
        totals: {
            total: t.total,
            active: t.active,
            inactive: t.total - t.active,
            withCoupon: t.withCoupon,
            minPrice: t.minPrice || 0,
            maxPrice: t.maxPrice || 0,
            noPrice: t.noPrice,
        },
        cities: cities.map((c) => ({ city: c._id, total: c.total, active: c.active })),
        tiers: VO_TIERS,
    };
}

export async function getVirtualOffice(id) {
    if (!mongoose.isValidObjectId(id)) throw new VoError(404, 'Virtual office not found', 'NOT_FOUND');
    const doc = await VirtualOfficeListing.findById(id).lean();
    if (!doc) throw new VoError(404, 'Virtual office not found', 'NOT_FOUND');
    return doc;
}

export async function createVirtualOffice(input, actor = '') {
    const data = cleanInput(input);
    checkCoupon(data);
    const doc = new VirtualOfficeListing({ ...data, createdBy: actor, updatedBy: actor });
    doc.cityId = await resolveCityId(doc.city);
    doc.slug = await uniqueSlug(doc);
    await doc.save();
    return doc.toObject();
}

export async function updateVirtualOffice(id, input, actor = '') {
    if (!mongoose.isValidObjectId(id)) throw new VoError(404, 'Virtual office not found', 'NOT_FOUND');
    const doc = await VirtualOfficeListing.findById(id);
    if (!doc) throw new VoError(404, 'Virtual office not found', 'NOT_FOUND');
    const data = cleanInput(input, { partial: true });
    // Clearing the code clears the discount with it.
    if (data.couponCode === '' && data.couponPercentage === undefined) data.couponPercentage = 0;
    const cityChanged = data.city !== undefined && data.city !== doc.city;
    const nameChanged = ['spaceName', 'locality', 'city'].some((k) => data[k] !== undefined && data[k] !== doc[k]);
    doc.set({ ...data, updatedBy: actor });
    checkCoupon(doc);
    if (cityChanged || !doc.cityId) doc.cityId = await resolveCityId(doc.city);
    if (nameChanged || !doc.slug) doc.slug = await uniqueSlug(doc, doc._id);
    await doc.save();
    return doc.toObject();
}

export async function deleteVirtualOffice(id) {
    if (!mongoose.isValidObjectId(id)) throw new VoError(404, 'Virtual office not found', 'NOT_FOUND');
    const res = await VirtualOfficeListing.deleteOne({ _id: id });
    if (!res.deletedCount) throw new VoError(404, 'Virtual office not found', 'NOT_FOUND');
    return true;
}

/** Is this city inside the scope (null = all cities)? Handles Gurgaon / Gurugram etc. */
export function voCityAllowed(allowedCities, city) {
    if (!Array.isArray(allowedCities)) return true;
    const have = new Set(aliases(city));
    return allowedCities.some((c) => aliases(c).some((a) => have.has(a)));
}
