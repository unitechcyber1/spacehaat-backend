import { ObjectId } from 'mongodb';
import models from '../../models/index.js';

const ManagedOffice = models['ManagedOffice'];
const Brand = models['Brand'];

const SEAT_TYPES = ['warm_shell', 'ready_to_move_in', 'bare_shell'];

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** ObjectId for a valid 24-char hex id, otherwise null (avoids BSONError on bad query params). */
function parseObjectIdParam(value) {
    if (value == null || value === '') return null;
    const s = String(value).trim();
    return /^[a-fA-F0-9]{24}$/.test(s) ? new ObjectId(s) : null;
}

function notFound(message = 'Not Found') {
    throw { name: 'cofynd', code: 404, message };
}

/** Lowest monthly price among visible plans; null when every plan is "price on request". */
function startingPrice(plans = []) {
    const prices = plans
        .filter((p) => p && p.should_show !== false && Number(p.price) > 0)
        .map((p) => Number(p.price));
    return prices.length ? Math.min(...prices) : null;
}

/** `.lean()` drops the `id` virtual; add it to every embedded doc so the shape matches workspace responses. */
function withIds(value) {
    if (Array.isArray(value)) return value.map(withIds);
    if (value instanceof ObjectId || value instanceof Date || !value || typeof value !== 'object') return value;
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = withIds(v);
    if (value._id instanceof ObjectId && out.id === undefined) out.id = String(value._id);
    return out;
}

/** Public shape: hide import bookkeeping, add `id` and `starting_price`. */
function toPublic(doc) {
    if (!doc) return doc;
    const { source, __v, ...rest } = doc;
    return { ...withIds(rest), id: String(doc._id), starting_price: startingPrice(doc.plans) };
}

const listPopulate = [
    { path: 'images.image', select: 's3_link title name folder_name brightness contrast' },
    { path: 'location.city', select: 'name' },
    { path: 'location.micro_location', select: 'name' },
    { path: 'brand', select: 'name slug image', populate: { path: 'image', select: 's3_link' } },
    { path: 'plans.category', select: 'name' },
];

class ManageManagedOfficeService {
    async _resolveBrandIds(brand, brandName) {
        const or = [];
        const value = brand != null ? String(brand).trim() : '';
        if (value) {
            const id = parseObjectIdParam(value);
            if (id) or.push({ _id: id });
            or.push({ slug: value.toLowerCase() });
            or.push({ name: { $regex: `^${escapeRegex(value)}$`, $options: 'i' } });
        }
        const partial = brandName != null ? String(brandName).trim() : '';
        if (partial) or.push({ name: { $regex: escapeRegex(partial), $options: 'i' } });
        if (!or.length) return null;
        const brands = await Brand.find({ $or: or }, { _id: 1 }).lean();
        return brands.map((b) => b._id);
    }

    /**
     * GET /api/user/managedOffices
     * Query: city, micro_location, locations (JSON array of micro location ids), brand, brand_name,
     *        name, seat_type, minPrice, maxPrice, min_seats, limit, page
     */
    async getManagedOffices({
        limit = 10,
        skip = 0,
        city,
        micro_location,
        locations,
        brand,
        brand_name,
        name,
        seat_type,
        minPrice,
        maxPrice,
        min_seats,
    } = {}) {
        const condition = { status: 'approve', is_active: { $ne: false } };
        let sort = { 'priority.overall.is_active': -1, 'priority.overall.order': 1, added_on: -1, _id: -1 };

        const cityId = parseObjectIdParam(city);
        if (cityId) {
            condition['location.city'] = cityId;
            sort = { 'priority.location.is_active': -1, 'priority.location.order': 1, added_on: -1, _id: -1 };
        }

        const microId = parseObjectIdParam(micro_location);
        if (microId) {
            condition['location.micro_location'] = microId;
            sort = { 'priority.micro_location.is_active': -1, 'priority.micro_location.order': 1, added_on: -1, _id: -1 };
        }

        if (locations) {
            let ids = [];
            try {
                ids = (Array.isArray(locations) ? locations : JSON.parse(locations)).map(parseObjectIdParam).filter(Boolean);
            } catch {
                ids = String(locations).split(',').map(parseObjectIdParam).filter(Boolean);
            }
            if (ids.length) condition['location.micro_location'] = { $in: ids };
        }

        const brandIds = await this._resolveBrandIds(brand, brand_name);
        if (brandIds) condition.brand = { $in: brandIds };

        if (name != null && String(name).trim() !== '') {
            condition.name = { $regex: escapeRegex(String(name).trim()), $options: 'i' };
        }

        // Plan filters apply to the same plan: a visible plan of that seat type within the price range.
        const planMatch = {};
        if (seat_type && SEAT_TYPES.includes(String(seat_type))) planMatch.seat_type = String(seat_type);
        const min = Number(minPrice);
        const max = Number(maxPrice);
        if ((Number.isFinite(min) && min > 0) || (Number.isFinite(max) && max > 0)) {
            planMatch.should_show = { $ne: false };
            planMatch.price = { $gt: 0 };
            if (Number.isFinite(min) && min > 0) planMatch.price.$gte = min;
            if (Number.isFinite(max) && max > 0) planMatch.price.$lte = max;
        }
        if (Object.keys(planMatch).length) condition.plans = { $elemMatch: planMatch };

        const seats = Number(min_seats);
        if (Number.isFinite(seats) && seats > 0) condition.no_of_seats = { $gte: seats };

        const [docs, count] = await Promise.all([
            ManagedOffice.find(condition)
                .sort(sort)
                .skip(Number(skip) || 0)
                .limit(Number(limit) || 10)
                .populate(listPopulate)
                .lean(),
            ManagedOffice.countDocuments(condition),
        ]);

        return { managedOffices: docs.map(toPublic), count };
    }

    /** GET /api/user/managedOffice/:findKey (slug or id) */
    async getManagedOfficeByIdOrSlug({ findKey }) {
        const key = String(findKey || '').trim();
        const id = parseObjectIdParam(key);
        const condition = { status: 'approve', ...(id ? { _id: id } : { slug: key }) };

        const doc = await ManagedOffice.findOne(condition)
            .populate('amenties')
            .populate('location.city')
            .populate('location.micro_location')
            .populate('location.state', 'name')
            .populate('location.country', 'name')
            .populate('images.image')
            .populate('plans.image')
            .populate('plans.category')
            .populate('building.floors.floor_plan')
            .populate('seo.twitter.image')
            .populate('seo.open_graph.image')
            .populate('new_seo.twitter.image')
            .populate('new_seo.open_graph.image')
            .populate({ path: 'brand', populate: { path: 'image' } })
            .lean();

        if (!doc) notFound('Managed office not found');
        return toPublic(doc);
    }
}

export default new ManageManagedOfficeService();
