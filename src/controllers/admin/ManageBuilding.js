import service from '../../services/admin/manage-building.js';

/** Admin: office buildings and which coworking spaces / managed offices are in them. */
class ManageBuilding {
    async getBuildings(req, res, next) {
        try {
            const data = await service.getBuildings(req.query);
            res.status(200).json({ message: 'Building list', data: data.buildings, totalRecords: data.count });
        } catch (error) {
            next(error);
        }
    }

    async getBuilding(req, res, next) {
        try {
            res.status(200).json({ message: 'Building', data: await service.getBuilding(req.params) });
        } catch (error) {
            next(error);
        }
    }

    async addOrEditBuilding(req, res, next) {
        try {
            const data = req.method === 'PUT'
                ? await service.editBuilding({ ...req.body, buildingId: req.params.buildingId })
                : await service.addBuilding(req.body);
            res.status(200).json({ message: req.method === 'PUT' ? 'Building updated' : 'Building added', data });
        } catch (error) {
            next(error);
        }
    }

    async deleteBuilding(req, res, next) {
        try {
            await service.deleteBuilding(req.params);
            res.status(200).json({ message: 'Building deleted' });
        } catch (error) {
            next(error);
        }
    }

    async getCentreBuilding(req, res, next) {
        try {
            res.status(200).json({ message: 'Centre building', data: await service.getCentreBuilding(req.params) });
        } catch (error) {
            next(error);
        }
    }

    async setCentreBuilding(req, res, next) {
        try {
            res.status(200).json({ message: 'Centre building updated', data: await service.setCentreBuilding(req.body) });
        } catch (error) {
            next(error);
        }
    }

    async searchCentres(req, res, next) {
        try {
            res.status(200).json({ message: 'Centres', data: await service.searchCentres(req.query) });
        } catch (error) {
            next(error);
        }
    }
}

export default new ManageBuilding();
