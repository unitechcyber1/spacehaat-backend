import manageBuildingService from '../../services/user/manage-building.js';

class ManageBuilding {
    constructor() {
        return {
            getBuildings: this.getBuildings.bind(this),
            getBuildingBySlug: this.getBuildingBySlug.bind(this),
        };
    }

    async getBuildings(req, res, next) {
        try {
            const data = await manageBuildingService.getBuildings(req.query);
            res.status(200).json({ message: 'Building list', data, totalRecords: data.length });
        } catch (error) {
            next(error);
        }
    }

    async getBuildingBySlug(req, res, next) {
        try {
            const data = await manageBuildingService.getBuildingBySlug(req.params);
            if (!data) return res.status(404).json({ message: 'Building not found', data: null });
            res.status(200).json({ message: 'Building detail', data });
        } catch (error) {
            next(error);
        }
    }
}

export default new ManageBuilding();
