import ManageFlatPlansService from '../../services/admin/manage-flat-category.js';

class ManageFlatPlans {
    constructor() {
        return {
            getFlatPlans: this.getFlatPlans.bind(this),
            getFlatPlansById: this.getFlatPlansById.bind(this),
            addOrEditFlatPlans: this.addOrEditFlatPlans.bind(this),
            toggleFlatPlansStatus: this.toggleFlatPlansStatus.bind(this),
            deleteFlatPlans: this.deleteFlatPlans.bind(this),
            ActiveFlatPlans: this.ActiveFlatPlans.bind(this),
        }
    }

    async getFlatPlans(req, res, next) {
        try {
            const result = await ManageFlatPlansService.getFlatPlans(req.query);
            return res.status(200).json({
                message: "State List",
                data: result.states,
                totalRecords: result.count
            })
        } catch (e) {
            next(e)
        }
    }
    async ActiveFlatPlans(req, res, next) {
        try {
            const result = await ManageFlatPlansService.getActiveFlatPlans(req.query);
            return res.status(200).json({
                message: "State List",
                data: result,
                totalRecords: result.length
            })
        } catch (e) {
            next(e)
        }
    }

    async getFlatPlansById(req, res, next) {
        try {
            const state = await ManageFlatPlansService.getFlatPlansById(req.params);
            res.status(200).json({
                message: 'get State by id',
                data: state
            })
        } catch (error) {
            next(error);
        }
    }

    async addOrEditFlatPlans(req, res, next) {
        try {
            let state = null;
            let message = 'FlatPlans Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body);
                state = await ManageFlatPlansService.updateFlatPlans(forEdit);
                message = 'FlatPlans Updated';
            } else {
                state = await ManageFlatPlansService.addFlatPlans(req.body);
            }
            res.status(200).json({
                message,
                data: state
            });
        } catch (error) {
            next(error)
        }
    }

    async toggleFlatPlansStatus(req, res, next) {
        try {
            await ManageFlatPlansService.toggleFlatPlansStatus(req.params);
            return res.status(200).json({
                message: "State Status Changed"
            })
        } catch (e) {
            next(e)
        }
    }

    async deleteFlatPlans(req, res, next) {
        try {
            await ManageFlatPlansService.deleteFlatPlans(req.params);
            res.status(200).json({
                message: 'Room deleted'
            })
        } catch (error) {
            next(error);
        }
    }



}

export default new ManageFlatPlans();