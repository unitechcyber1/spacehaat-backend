import manageBuilderService from '../../services/user/manage-builder.js';

class ManageCoLivingSpace {
    constructor() {
        return {
            getBuilders: this.getBuilders.bind(this),
            getBuildersById: this.getBuildersById.bind(this),
            getBuildersByName: this.getBuildersByName.bind(this),
            getBuilderComResiProjects: this.getBuilderComResiProjects.bind(this),
            getPriorityBuilders: this.getPriorityBuilders.bind(this)
        }
    }

    async getBuilders(req, res, next) {
        try {
            const result = await manageBuilderService.getBuilders(req.query);
            res.status(200).json({
                message: 'Builder list',
                data: result.builders,
                totalRecords: result.count
            })
        } catch (error) {
            next(error)
        }
    }

    async getBuildersById(req, res, next) {
        try {
            const result = await manageBuilderService.getBuildersById(req.params);
            res.status(200).json({
                message: 'Builder by Id',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async getBuildersByName(req, res, next) {
        try {
            const result = await manageBuilderService.getBuildersByName(req.params);
            res.status(200).json({
                message: 'Builder by Name',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async getBuilderComResiProjects(req, res, next) {
        try {
            const result = await manageBuilderService.getBuilderComResiProjects(req.query);
            res.status(200).json({
                message: 'SubBuilder by Resi & Comm.',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }
    async getPriorityBuilders(req, res, next) {
        try {
            const result = await manageBuilderService.getPriorityBuilders(req.query);
            res.status(200).json({
                message: 'Priority Builders List',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

}

export default new ManageCoLivingSpace();