import managePgService from '../../services/admin/manage-pg.js';

class ManagePg {
    constructor() {
        return {
            getPgs: this.getPgs.bind(this),
            getPgById: this.getPgById.bind(this),
            createOrUpdatePg: this.createOrUpdatePg.bind(this),
            deletePg: this.deletePg.bind(this),
            changePgStatus: this.changePgStatus.bind(this),
            addPriorityPgs: this.addPriorityPgs.bind(this),
            setPriorityByType: this.setPriorityByType.bind(this),
            pgOrderByDrag: this.pgOrderByDrag.bind(this),
            getPriorityPgs: this.getPriorityPgs.bind(this),
        };
    }

    async getPgs(req, res, next) {
        try {
            const result = await managePgService.getPgs(req.query);
            res.status(200).json({
                message: 'PG list',
                data: result.pgs,
                totalRecords: result.count,
            });
        } catch (error) {
            next(error);
        }
    }

    async getPgById(req, res, next) {
        try {
            const data = await managePgService.getPgById(req.params);
            res.status(200).json({
                message: 'PG detail',
                data,
            });
        } catch (error) {
            next(error);
        }
    }

    async createOrUpdatePg(req, res, next) {
        try {
            let data;
            let message = 'PG created';
            if (req.method === 'PUT') {
                const merged = Object.assign({}, req.params, req.body);
                data = await managePgService.updatePg(merged);
                message = 'PG updated';
            } else {
                data = await managePgService.createPg(req.body);
            }
            res.status(200).json({ message, data });
        } catch (error) {
            next(error);
        }
    }

    async deletePg(req, res, next) {
        try {
            const data = await managePgService.deletePg(req.params);
            res.status(200).json({
                message: 'PG removed (soft delete)',
                data,
            });
        } catch (error) {
            next(error);
        }
    }

    async changePgStatus(req, res, next) {
        try {
            const merged = Object.assign({}, req.params, req.body);
            const data = await managePgService.changePgStatus(merged);
            res.status(200).json({
                message: 'PG status updated',
                data,
            });
        } catch (error) {
            next(error);
        }
    }

    async getPriorityPgs(req, res, next) {
        try {
            const result = await managePgService.getPriorityPgs(req.query);
            res.status(200).json({
                message: 'Priority PG list',
                data: result.priorityPgs,
                totalRecords: result.count,
            });
        } catch (error) {
            next(error);
        }
    }

    async addPriorityPgs(req, res, next) {
        try {
            await managePgService.addPriorityPgs(req.body);
            res.status(200).json({ message: 'Priority PG updated' });
        } catch (error) {
            next(error);
        }
    }

    async setPriorityByType(req, res, next) {
        try {
            await managePgService.setPriorityByType(req.body);
            res.status(200).json({ message: 'Priority PG order updated' });
        } catch (error) {
            next(error);
        }
    }

    async pgOrderByDrag(req, res, next) {
        try {
            await managePgService.pgOrderByDrag(req.body);
            res.status(200).json({ message: 'Priority PG drag order saved' });
        } catch (error) {
            next(error);
        }
    }
}

export default new ManagePg();
