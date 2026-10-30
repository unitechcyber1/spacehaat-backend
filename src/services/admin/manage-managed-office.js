import { ObjectId } from 'mongodb';
import models from '../../models/index.js';
import { slugifyText } from '../../utilities/pg-slug.js';

const ManagedOffice = models['ManagedOffice'];
const MicroLocation = models['MicroLocation'];
const Brand = models['Brand'];

const STATUSES = ['pending', 'approve', 'reject', 'inprogress'];
const SEAT_TYPES = ['warm_shell', 'ready_to_move_in', 'bare_shell'];
const SORT_FIELDS = {
    name: 'name',
    city: 'location.city',
    location: 'location.micro_location_string',
    status: 'status',
    price: 'plans.price',
    seats: 'no_of_seats',
    added_on: 'added_on',
    updated_on: 'updated_on',
};
/** Fields the admin form may not overwrite. */
const READ_ONLY_FIELDS = ['_id', 'id', '__v', 'added_on', 'updated_on', 'source', 'starting_price', 'space_type'];

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toObjectId(value) {
    if (value == null || value === '') return null;
    if (value instanceof ObjectId) return value;
    if (typeof value === 'object') return toObjectId(value._id ?? value.id);
    const s = String(value).trim();
    return /^[a-fA-F0-9]{24}$/.test(s) ? new ObjectId(s) : null;
}

function fail(code, message) {
    throw { name: 'cofynd', code, message };
}

function toNumberOrUndefined(value) {
    if (value === '' || value == null) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}

const detailPopulate = [
    { path: 'images.image' },
    { path: 'amenties' },
    { path: 'brand', select: 'name slug type image', populate: { path: 'image', select: 's3_link' } },
    { path: 'location.city', select: 'name state country' },
    { path: 'location.micro_location', select: 'name city' },
    { path: 'location.state', select: 'name' },
    { path: 'location.country', select: 'name' },
    { path: 'plans.category', select: 'name' },
    { path: 'plans.image' },
    { path: 'seo.twitter.image' },
    { path: 'seo.open_graph.image' },
    { path: 'new_seo.twitter.image' },
    { path: 'new_seo.open_graph.image' },
];

class ManageManagedOfficeService {
    /**
     * GET /api/admin/managedOffices
     * Query: name, city, location (micro-location name text), micro_location, brand, status (or "all"),
     *        seat_type, centre_type, has_price ("true" | "false"), sortBy, orderBy, limit, page
     */
    async getManagedOffices({
        limit = 10,
        skip = 0,
        sortBy,
        orderBy = 1,
        name,
        city,
        location,
        micro_location,
        brand,
        status,
        seat_type,
        centre_type,
        has_price,
    } = {}) {
        const condition = {};

        if (name && String(name).trim()) {
            const term = escapeRegex(String(name).trim());
            condition.$or = [
                { name: { $regex: term, $options: 'i' } },
                { slug: { $regex: term, $options: 'i' } },
                { 'location.building_name': { $regex: term, $options: 'i' } },
            ];
        }

        const cityId = toObjectId(city);
        if (cityId) condition['location.city'] = cityId;

        const microId = toObjectId(micro_location);
        if (microId) {
            condition['location.micro_location'] = microId;
        } else if (location && String(location).trim()) {
            const term = escapeRegex(String(location).trim());
            const micros = await MicroLocation.find({ name: { $regex: term, $options: 'i' } }, { _id: 1 }).lean();
            condition.$and = [
                ...(condition.$and || []),
                {
                    $or: [
                        { 'location.micro_location': { $in: micros.map((m) => m._id) } },
                        { 'location.micro_location_string': { $regex: term, $options: 'i' } },
                    ],
                },
            ];
        }

        const brandId = toObjectId(brand);
        if (brandId) condition.brand = brandId;

        if (status && status !== 'all' && STATUSES.includes(status)) condition.status = status;
        if (seat_type && SEAT_TYPES.includes(seat_type)) condition['plans.seat_type'] = seat_type;
        if (centre_type === 'managed_office' || centre_type === 'coworking') condition.centre_type = centre_type;
        if (has_price === 'true') condition.plans = { $elemMatch: { price: { $gt: 0 } } };
        if (has_price === 'false') condition['plans.price'] = { $not: { $gt: 0 } };

        const field = SORT_FIELDS[sortBy] || 'added_on';
        const direction = Number(orderBy) === -1 || (!SORT_FIELDS[sortBy] && field === 'added_on') ? -1 : 1;
        const sort = { [field]: direction, _id: direction };

        const [managedOffices, count] = await Promise.all([
            ManagedOffice.find(condition)
                .populate('location.city', 'name')
                .populate('location.micro_location', 'name')
                .populate('brand', 'name slug')
                .populate({ path: 'images.image', select: 's3_link title' })
                .sort(sort)
                .collation({ locale: 'en', strength: 2 })
                .skip(Number(skip) || 0)
                .limit(Number(limit) || 10),
            ManagedOffice.countDocuments(condition),
        ]);

        return { managedOffices, count };
    }

    /** GET /api/admin/managedOffice/:managedOfficeId */
    async getManagedOfficeById({ managedOfficeId }) {
        const id = toObjectId(managedOfficeId);
        if (!id) fail(400, 'Invalid managed office id');
        const doc = await ManagedOffice.findById(id).populate(detailPopulate);
        if (!doc) fail(404, 'Managed office not found');
        return doc;
    }

    async _uniqueSlug(base, excludeId) {
        const root = slugifyText(base) || 'managed-office';
        let slug = root;
        for (let i = 2; await ManagedOffice.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }); i++) {
            slug = `${root}-${i}`;
        }
        return slug;
    }

    /** Admin form body → document fields (ids for refs, numbers for numeric inputs, geometry from lat/lng). */
    _sanitize(body = {}) {
        const data = { ...body };
        READ_ONLY_FIELDS.forEach((k) => delete data[k]);
        // Admin-only bookkeeping from sanatize middleware / form helpers.
        delete data.added_by;
        delete data.updated_by;

        if ('brand' in data) data.brand = toObjectId(data.brand) || undefined;

        if (Array.isArray(data.images)) {
            data.images = data.images
                .map((row, i) => ({ image: toObjectId(row?.image ?? row), order: Number(row?.order) || i + 1 }))
                .filter((row) => row.image);
        }

        if (Array.isArray(data.amenties)) {
            data.amenties = data.amenties.map(toObjectId).filter(Boolean);
        }

        if (Array.isArray(data.plans)) {
            data.plans = data.plans.map((p = {}) => ({
                ...(toObjectId(p._id) ? { _id: toObjectId(p._id) } : {}),
                category: toObjectId(p.category) || undefined,
                image: toObjectId(p.image) || undefined,
                seat_type: SEAT_TYPES.includes(p.seat_type) ? p.seat_type : undefined,
                duration: p.duration || 'month',
                time_period: toNumberOrUndefined(p.time_period),
                price: toNumberOrUndefined(p.price) ?? 0,
                number_of_items: toNumberOrUndefined(p.number_of_items) ?? 1,
                should_show: p.should_show !== false,
            }));
        }

        if (data.location && typeof data.location === 'object') {
            const loc = { ...data.location };
            for (const k of ['country', 'state', 'city', 'micro_location']) {
                const id = toObjectId(loc[k]);
                if (id) loc[k] = id;
                else delete loc[k];
            }
            loc.latitude = toNumberOrUndefined(loc.latitude);
            loc.longitude = toNumberOrUndefined(loc.longitude);
            if (loc.latitude == null) delete loc.latitude;
            if (loc.longitude == null) delete loc.longitude;
            data.location = loc;
            if (loc.latitude != null && loc.longitude != null) {
                data.geometry = { type: 'Point', coordinates: [loc.longitude, loc.latitude] };
            }
        }

        if (data.building && typeof data.building === 'object') {
            const b = data.building;
            data.building = {
                total_floors: toNumberOrUndefined(b.total_floors),
                super_area: toNumberOrUndefined(b.super_area),
                total_seats: toNumberOrUndefined(b.total_seats),
                floors: (Array.isArray(b.floors) ? b.floors : []).map((f = {}) => ({
                    floor_number: toNumberOrUndefined(f.floor_number),
                    area: toNumberOrUndefined(f.area),
                    seats: toNumberOrUndefined(f.seats),
                    floor_plan: toObjectId(f.floor_plan) || undefined,
                })),
            };
        }

        if (data.lease_terms && typeof data.lease_terms === 'object') {
            data.lease_terms = {
                min_seats: toNumberOrUndefined(data.lease_terms.min_seats),
                min_duration_months: toNumberOrUndefined(data.lease_terms.min_duration_months),
            };
        }

        if (data.rating && typeof data.rating === 'object') {
            data.rating = {
                source: data.rating.source || undefined,
                average: toNumberOrUndefined(data.rating.average),
                total: toNumberOrUndefined(data.rating.total),
            };
        }

        if ('no_of_seats' in data) data.no_of_seats = toNumberOrUndefined(data.no_of_seats);

        for (const block of ['seo', 'new_seo']) {
            const seo = data[block];
            if (!seo || typeof seo !== 'object') continue;
            for (const k of ['twitter', 'open_graph']) {
                if (seo[k] && typeof seo[k] === 'object') {
                    seo[k] = { ...seo[k], image: toObjectId(seo[k].image) || null };
                }
            }
        }

        if (data.status && !STATUSES.includes(data.status)) delete data.status;
        return data;
    }

    _keepPriorityInSync(data) {
        const city = data.location?.city;
        if (!city) return;
        data['priority.location.city'] = city;
        data['priority.micro_location.city'] = city;
        if (data.location.micro_location) data['priority.micro_location.name'] = data.location.micro_location;
    }

    /** POST /api/admin/managedOffice */
    async createManagedOffice(body) {
        const data = this._sanitize(body);
        if (!data.name || !String(data.name).trim()) fail(400, 'Name is required');
        data.slug = await this._uniqueSlug(data.slug || `${data.name} ${data.location?.micro_location_string || ''}`);
        data.source = { provider: 'spacewallah' };
        const doc = new ManagedOffice(data);
        const city = data.location?.city;
        if (city) {
            doc.set('priority.location.city', city);
            doc.set('priority.micro_location.city', city);
            if (data.location.micro_location) doc.set('priority.micro_location.name', data.location.micro_location);
        }
        await doc.save();
        return this.getManagedOfficeById({ managedOfficeId: doc._id });
    }

    /** PUT /api/admin/managedOffice/:id */
    async updateManagedOffice({ id, ...body }) {
        const _id = toObjectId(id);
        if (!_id) fail(400, 'Invalid managed office id');
        if (!(await ManagedOffice.exists({ _id }))) fail(404, 'Managed office not found');

        const data = this._sanitize(body);
        if ('name' in data && !String(data.name || '').trim()) fail(400, 'Name is required');
        if ('slug' in data) {
            const wanted = slugifyText(data.slug || '');
            if (!wanted) delete data.slug;
            else if (await ManagedOffice.exists({ slug: wanted, _id: { $ne: _id } })) fail(409, `Slug "${wanted}" is already used`);
            else data.slug = wanted;
        }
        // `priority` is managed by the priority screens; only keep its city refs aligned with the location.
        delete data.priority;
        this._keepPriorityInSync(data);

        await ManagedOffice.updateOne({ _id }, { $set: data }, { runValidators: true });
        return this.getManagedOfficeById({ managedOfficeId: _id });
    }

    /** POST /api/admin/managedOffice/changeStatus/:managedOfficeId  body: { status } */
    async changeManagedOfficeStatus({ managedOfficeId, status }) {
        const _id = toObjectId(managedOfficeId);
        if (!_id) fail(400, 'Invalid managed office id');
        if (!STATUSES.includes(status)) fail(400, `Status must be one of ${STATUSES.join(', ')}`);
        const doc = await ManagedOffice.findByIdAndUpdate(_id, { $set: { status } }, { new: true });
        if (!doc) fail(404, 'Managed office not found');
        return doc;
    }

    /** DELETE /api/admin/managedOffice/:id — removes the record; its Image docs and S3 files are kept. */
    async deleteManagedOffice({ id }) {
        const _id = toObjectId(id);
        if (!_id) fail(400, 'Invalid managed office id');
        const doc = await ManagedOffice.findByIdAndDelete(_id);
        if (!doc) fail(404, 'Managed office not found');
        return { id: String(_id) };
    }

    /** PUT /api/admin/managedOffices/slug/update  body: { id, slug } */
    async changeSlug({ id, slug }) {
        const _id = toObjectId(id);
        if (!_id) fail(400, 'Invalid managed office id');
        const wanted = slugifyText(slug || '');
        if (!wanted) fail(400, 'Slug is required');
        if (await ManagedOffice.exists({ slug: wanted, _id: { $ne: _id } })) fail(409, `Slug "${wanted}" is already used`);
        const doc = await ManagedOffice.findByIdAndUpdate(_id, { $set: { slug: wanted } }, { new: true });
        if (!doc) fail(404, 'Managed office not found');
        return doc;
    }

    /** Brands that have managed offices, for the list filter. */
    async getManagedOfficeBrands() {
        const ids = await ManagedOffice.distinct('brand');
        return Brand.find({ _id: { $in: ids.filter(Boolean) } }, { name: 1, slug: 1 }).sort({ name: 1 });
    }
}

export default new ManageManagedOfficeService();
