import mongoose from 'mongoose';
import models from '../../models/index.js';
import { slugifyText } from '../../utilities/pg-slug.js';

const { ObjectId } = mongoose.Types;
const { Building, WorkSpace, ManagedOffice, City } = models;

/** Centre types an admin can put in a building, and the model behind each. */
const CENTRE_MODEL = { coworking: WorkSpace, managed_office: ManagedOffice };
const CENTRE_FIELDS = { name: 1, slug: 1, status: 1, is_active: 1, building_id: 1, 'location.city': 1, 'location.micro_location': 1, 'location.address': 1 };

/** Same rule as the website: a building gets a page with this many live centres. */
export const MIN_CENTRES_FOR_BUILDING_PAGE = 2;

function fail(code, message) {
    throw { name: 'cofynd', code, message };
}

function toObjectId(value) {
    if (value == null || value === '') return null;
    if (value instanceof ObjectId) return value;
    if (typeof value === 'object') return toObjectId(value._id ?? value.id);
    const s = String(value).trim();
    return /^[a-fA-F0-9]{24}$/.test(s) ? new ObjectId(s) : null;
}

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toNumberOrNull(value) {
    if (value === '' || value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function isLive(doc) {
    return doc.status === 'approve' && doc.is_active !== false;
}

function centreRow(type, doc, buildingNames = new Map()) {
    return {
        type,
        id: String(doc._id),
        name: doc.name,
        slug: String(doc.slug || '').trim(),
        status: doc.status,
        live: isLive(doc),
        city: doc.location?.city?.name ?? null,
        area: doc.location?.micro_location?.name ?? null,
        address: doc.location?.address ?? null,
        building_id: doc.building_id ? String(doc.building_id) : null,
        building_name: doc.building_id ? buildingNames.get(String(doc.building_id)) ?? null : null,
    };
}

class ManageBuildingAdminService {
    /** { [buildingId]: { coworking, managed_office, live } } for the given buildings. */
    async _counts(ids) {
        const out = new Map(ids.map((id) => [String(id), { coworking: 0, managed_office: 0, live: 0 }]));
        for (const [type, Model] of Object.entries(CENTRE_MODEL)) {
            const docs = await Model.find({ building_id: { $in: ids } }, { building_id: 1, status: 1, is_active: 1 }).lean();
            for (const d of docs) {
                const c = out.get(String(d.building_id));
                if (!c) continue;
                c[type] += 1;
                if (isLive(d)) c.live += 1;
            }
        }
        return out;
    }

    async _uniqueSlug(wanted, exceptId) {
        const base = slugifyText(wanted) || 'building';
        let slug = base;
        for (let i = 2; await Building.exists({ slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }); i++) {
            slug = `${base}-${i}`;
        }
        return slug;
    }

    async _fields(body) {
        const fields = {};
        if ('name' in body) fields.name = String(body.name || '').trim();
        if ('city' in body) fields.city = toObjectId(body.city);
        if ('micro_location' in body) fields.micro_location = toObjectId(body.micro_location);
        for (const k of ['address', 'image', 'description']) {
            if (k in body) fields[k] = String(body[k] ?? '').trim();
        }
        if ('latitude' in body) fields.latitude = toNumberOrNull(body.latitude);
        if ('longitude' in body) fields.longitude = toNumberOrNull(body.longitude);
        if ('is_active' in body) fields.is_active = body.is_active !== false && body.is_active !== 'false';
        return fields;
    }

    /** GET /api/admin/buildings — name / city filters, with centre counts. */
    async getBuildings({ name, city, limit, skip, all }) {
        const condition = {};
        if (name && String(name).trim()) condition.name = { $regex: escapeRegex(String(name).trim()), $options: 'i' };
        const cityId = toObjectId(city);
        if (cityId) condition.city = cityId;
        const query = Building.find(condition)
            .populate('city', 'name')
            .populate('micro_location', 'name')
            .sort({ name: 1 })
            .lean();
        if (String(all) !== 'true') query.skip(skip || 0).limit(limit || 10);
        const [rows, count] = await Promise.all([query, Building.countDocuments(condition)]);
        const counts = await this._counts(rows.map((b) => b._id));
        const buildings = rows.map((b) => {
            const c = counts.get(String(b._id));
            return {
                ...b,
                id: String(b._id),
                coworking_count: c.coworking,
                managed_office_count: c.managed_office,
                live_centres: c.live,
                has_page: b.is_active !== false && c.live >= MIN_CENTRES_FOR_BUILDING_PAGE,
            };
        });
        return { buildings, count };
    }

    /** GET /api/admin/building/:buildingId — the building and every centre linked to it. */
    async getBuilding({ buildingId }) {
        const _id = toObjectId(buildingId);
        if (!_id) fail(400, 'Invalid building id');
        const building = await Building.findById(_id).populate('city', 'name').populate('micro_location', 'name').lean();
        if (!building) fail(404, 'Building not found');
        const centres = [];
        for (const [type, Model] of Object.entries(CENTRE_MODEL)) {
            const docs = await Model.find({ building_id: _id }, CENTRE_FIELDS)
                .populate('location.city', 'name')
                .populate('location.micro_location', 'name')
                .sort({ name: 1 })
                .lean();
            centres.push(...docs.map((d) => centreRow(type, d)));
        }
        const live = centres.filter((c) => c.live).length;
        return {
            ...building,
            id: String(building._id),
            centres,
            live_centres: live,
            has_page: building.is_active !== false && live >= MIN_CENTRES_FOR_BUILDING_PAGE,
        };
    }

    /** POST /api/admin/building */
    async addBuilding(body) {
        const fields = await this._fields(body);
        if (!fields.name) fail(400, 'Name is required');
        let citySlug = '';
        if (fields.city) citySlug = (await City.findById(fields.city, { name: 1 }).lean())?.name ?? '';
        const slug = await this._uniqueSlug(body.slug || `${fields.name} ${citySlug}`);
        const doc = await Building.create({ ...fields, slug });
        return this.getBuilding({ buildingId: doc._id });
    }

    /** PUT /api/admin/building/:buildingId */
    async editBuilding({ buildingId, ...body }) {
        const _id = toObjectId(buildingId);
        if (!_id) fail(400, 'Invalid building id');
        if (!(await Building.exists({ _id }))) fail(404, 'Building not found');
        const fields = await this._fields(body);
        if ('name' in fields && !fields.name) fail(400, 'Name is required');
        if ('slug' in body) {
            const wanted = slugifyText(body.slug || '');
            if (wanted) {
                if (await Building.exists({ slug: wanted, _id: { $ne: _id } })) fail(409, `Slug "${wanted}" is already used by another building`);
                fields.slug = wanted;
            }
        }
        await Building.updateOne({ _id }, { $set: fields });
        return this.getBuilding({ buildingId: _id });
    }

    /** DELETE /api/admin/building/:buildingId — also takes its centres out of it. */
    async deleteBuilding({ buildingId }) {
        const _id = toObjectId(buildingId);
        if (!_id) fail(400, 'Invalid building id');
        await Promise.all(Object.values(CENTRE_MODEL).map((M) => M.updateMany({ building_id: _id }, { $unset: { building_id: 1 } })));
        await Building.deleteOne({ _id });
        return true;
    }

    /**
     * PUT /api/admin/building-centre — put one centre in a building, or take it out.
     * Body: { type: 'coworking' | 'managed_office', id, building_id (null/'' to remove) }.
     */
    async setCentreBuilding({ type, id, building_id }) {
        const Model = CENTRE_MODEL[type];
        if (!Model) fail(400, 'type must be coworking or managed_office');
        const centreId = toObjectId(id);
        if (!centreId) fail(400, 'Invalid centre id');
        const buildingId = toObjectId(building_id);
        if (building_id && !buildingId) fail(400, 'Invalid building id');
        if (buildingId && !(await Building.exists({ _id: buildingId }))) fail(404, 'Building not found');
        const res = await Model.updateOne(
            { _id: centreId },
            buildingId ? { $set: { building_id: buildingId } } : { $unset: { building_id: 1 } },
        );
        if (!res.matchedCount) fail(404, 'Centre not found');
        return this.getCentreBuilding({ type, id: centreId });
    }

    /** GET /api/admin/building-centre/:type/:id — which building a centre is in (null when none). */
    async getCentreBuilding({ type, id }) {
        const Model = CENTRE_MODEL[type];
        if (!Model) fail(400, 'type must be coworking or managed_office');
        const centreId = toObjectId(id);
        if (!centreId) fail(400, 'Invalid centre id');
        const doc = await Model.findById(centreId, { building_id: 1 }).lean();
        if (!doc) fail(404, 'Centre not found');
        if (!doc.building_id) return { building: null };
        const building = await Building.findById(doc.building_id, { name: 1, slug: 1, is_active: 1 }).lean();
        return { building: building ? { id: String(building._id), name: building.name, slug: building.slug, is_active: building.is_active !== false } : null };
    }

    /**
     * GET /api/admin/building-centres/search?q=&city= — coworking spaces and managed offices by name,
     * for adding them to a building. Shows the building each one is already in.
     */
    async searchCentres({ q, city }) {
        const term = String(q || '').trim();
        if (term.length < 2) return [];
        const condition = { $or: [{ name: { $regex: escapeRegex(term), $options: 'i' } }, { slug: { $regex: escapeRegex(slugifyText(term)), $options: 'i' } }] };
        const cityId = toObjectId(city);
        if (cityId) condition['location.city'] = cityId;
        const rows = [];
        for (const [type, Model] of Object.entries(CENTRE_MODEL)) {
            const docs = await Model.find(condition, CENTRE_FIELDS)
                .populate('location.city', 'name')
                .populate('location.micro_location', 'name')
                .sort({ status: 1, name: 1 })
                .limit(15)
                .lean();
            rows.push(...docs.map((d) => ({ type, doc: d })));
        }
        const buildingIds = [...new Set(rows.map((r) => r.doc.building_id).filter(Boolean).map(String))];
        const names = new Map(
            (await Building.find({ _id: { $in: buildingIds } }, { name: 1 }).lean()).map((b) => [String(b._id), b.name]),
        );
        return rows.map((r) => centreRow(r.type, r.doc, names));
    }
}

export default new ManageBuildingAdminService();
