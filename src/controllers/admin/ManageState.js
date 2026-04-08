import manageStateService from '../../services/admin/manage-state.js';

class ManageState {
    constructor() {
        return {
            getStates: this.getStates.bind(this),
            getStateById: this.getStateById.bind(this),
            addOrEditState: this.addOrEditState.bind(this),
            toggleStateStatus: this.toggleStateStatus.bind(this),
            getStateByCountry: this.getStateByCountry.bind(this),
            deleteState: this.deleteState.bind(this)
                // getSpacesByCity: this.getSpacesByCity.bind(this),
        }
    }

    async getStates(req, res, next) {
        try {
            const result = await manageStateService.getStates(req.query);
            return res.status(200).json({
                message: "State List",
                data: result.states,
                totalRecords: result.count
            })
        } catch (e) {
            next(e)
        }
    }

    async getStateById(req, res, next) {
        try {
            const state = await manageStateService.getStateById(req.params);
            res.status(200).json({
                message: 'get State by id',
                data: state
            })
        } catch (error) {
            next(error);
        }
    }

    async addOrEditState(req, res, next) {
        try {
            let state = null;
            let message = 'State Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body);
                state = await manageStateService.updateState(forEdit);
                message = 'State Updated';
            } else {
                state = await manageStateService.addState(req.body);
            }
            res.status(200).json({
                message,
                data: state
            });
        } catch (error) {
            next(error)
        }
    }

    async toggleStateStatus(req, res, next) {
        try {
            await manageStateService.toggleStateStatus(req.params);
            return res.status(200).json({
                message: "State Status Changed"
            })
        } catch (e) {
            next(e)
        }
    }

    async getStateByCountry(req, res, next) {
        try {
            const states = await manageStateService.getStateByCountry(req.params);
            return res.status(200).json({
                message: "States by country",
                data: states
            })
        } catch (e) {
            next(e)
        }
    }

    // async getSpacesByCity(req, res, next) {
    //     try {
    //         const object = Object.assign({}, req.params, req.query);
    //         const result = await manageMicroLocationService.getSpacesByCity(object);
    //         res.status(200).json({
    //             message: 'get city by id',
    //             data: result
    //         })
    //     } catch (error) {
    //         next(error);
    //     }
    // }
    async deleteState(req, res, next) {
        try {
            await manageStateService.deleteState(req.params);
            res.status(200).json({
                message: 'state deleted'
            })
        } catch (error) {
            next(error);
        }
    }
}

export default new ManageState();