import models from '../../models/index.js';

const { Building, WorkSpace, ManagedOffice } = models;

/** A building page needs at least this many live centres (coworking + managed office). */
export const MIN_CENTRES_FOR_BUILDING_PAGE = 2;

const LIVE_WORKSPACE = { status: 'approve', is_active: { $ne: false } };
const LIVE_MANAGED_OFFICE = { status: 'approve', is_active: { $ne: false } };

const BUILDING_FIELDS = 'name slug city micro_location address latitude longitude image description updated_on';

class ManageBuildingService {
    /** Live centres per building: { [buildingId]: { coworking: [slug], managedOffice: [slug] } }. */
    async _centresByBuilding(buildingIds) {
        const match = { building_id: buildingIds ? { $in: buildingIds } : { $ne: null } };
        const [ws, mo] = await Promise.all([
            WorkSpace.find({ ...LIVE_WORKSPACE, ...match }, { slug: 1, building_id: 1 }).lean(),
            ManagedOffice.find({ ...LIVE_MANAGED_OFFICE, ...match, slug: { $nin: ['', null] } }, { slug: 1, building_id: 1 }).lean(),
        ]);
        const out = new Map();
        const entry = (id) => {
            const key = String(id);
            if (!out.has(key)) out.set(key, { coworking: [], managedOffice: [] });
            return out.get(key);
        };
        for (const w of ws) entry(w.building_id).coworking.push(String(w.slug).trim());
        for (const m of mo) entry(m.building_id).managedOffice.push(String(m.slug).trim());
        return out;
    }

    _shape(building, centres) {
        const c = centres ?? { coworking: [], managedOffice: [] };
        return {
            ...building,
            coworking_slugs: c.coworking,
            managed_office_slugs: c.managedOffice,
            total_centres: c.coworking.length + c.managedOffice.length,
        };
    }

    /**
     * GET /api/user/buildings — active buildings with 2+ live centres (the ones with a page).
     * Query: city (id), all=true to include buildings below the minimum.
     */
    async getBuildings({ city, all } = {}) {
        const condition = { is_active: { $ne: false } };
        if (city) condition.city = city;
        const buildings = await Building.find(condition, BUILDING_FIELDS)
            .populate('city', 'name')
            .populate('micro_location', 'name')
            .sort({ name: 1 })
            .lean();
        const centres = await this._centresByBuilding(buildings.map((b) => b._id));
        const rows = buildings.map((b) => this._shape(b, centres.get(String(b._id))));
        return String(all) === 'true' ? rows : rows.filter((b) => b.total_centres >= MIN_CENTRES_FOR_BUILDING_PAGE);
    }

    /** GET /api/user/building/:slug — one building with its live centre slugs (null when unknown). */
    async getBuildingBySlug({ slug }) {
        const key = String(slug || '').trim().toLowerCase();
        if (!key) return null;
        const building = await Building.findOne({ slug: key, is_active: { $ne: false } }, BUILDING_FIELDS)
            .populate('city', 'name')
            .populate('micro_location', 'name')
            .lean();
        if (!building) return null;
        const centres = await this._centresByBuilding([building._id]);
        return this._shape(building, centres.get(String(building._id)));
    }
}

export default new ManageBuildingService();
