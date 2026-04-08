import manageColivingPlansService from '../../services/admin/manage-coliving-category.js';

class ManageColivingPlans {
    constructor() {
        return {
            getColivingPlans: this.getColivingPlans.bind(this),
            getColivingPlansById: this.getColivingPlansById.bind(this),
            addOrEditColivingPlans: this.addOrEditColivingPlans.bind(this),
            toggleColivingPlansStatus: this.toggleColivingPlansStatus.bind(this),
            deleteColivingPlans: this.deleteColivingPlans.bind(this),
            ActiveColivingPlans: this.ActiveColivingPlans.bind(this),
        }
    }

    async getColivingPlans(req, res, next) {
        try {
            const result = await manageColivingPlansService.getColivingPlans(req.query);
            return res.status(200).json({
                message: "State List",
                data: result.states,
                totalRecords: result.count
            })
        } catch (e) {
            next(e)
        }
    }
    async ActiveColivingPlans(req, res, next) {
        try {
            const result = await manageColivingPlansService.getActiveColivingPlans(req.query);
            return res.status(200).json({
                message: "State List",
                data: result,
                totalRecords: result.length
            })
        } catch (e) {
            next(e)
        }
    }

    async getColivingPlansById(req, res, next) {
        try {
            const state = await manageColivingPlansService.getColivingPlansById(req.params);
            res.status(200).json({
                message: 'get State by id',
                data: state
            })
        } catch (error) {
            next(error);
        }
    }

    async addOrEditColivingPlans(req, res, next) {
        try {
            let state = null;
            let message = 'ColivingPlans Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body);
                state = await manageColivingPlansService.updateColivingPlans(forEdit);
                message = 'ColivingPlans Updated';
            } else {
                state = await manageColivingPlansService.addColivingPlans(req.body);
            }
            res.status(200).json({
                message,
                data: state
            });
        } catch (error) {
            next(error)
        }
    }

    async toggleColivingPlansStatus(req, res, next) {
        try {
            await manageColivingPlansService.toggleColivingPlansStatus(req.params);
            return res.status(200).json({
                message: "State Status Changed"
            })
        } catch (e) {
            next(e)
        }
    }

    async deleteColivingPlans(req, res, next) {
        try {
            await manageColivingPlansService.deleteColivingPlans(req.params);
            res.status(200).json({
                message: 'Room deleted'
            })
        } catch (error) {
            next(error);
        }
    }



}

export default new ManageColivingPlans();