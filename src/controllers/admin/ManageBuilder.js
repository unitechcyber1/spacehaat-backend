import manageBuilderService from '../../services/admin/manage-builder.js';

class ManageCoLivingSpace {
    constructor() {
        return {
            getBuilders: this.getBuilders.bind(this),
            getBuildersById: this.getBuildersById.bind(this),
            createOrUpdateBuilder: this.createOrUpdateBuilder.bind(this),
            addPriorityBuilder: this.addPriorityBuilder.bind(this),
            setPriorityByType: this.setPriorityByType.bind(this),
            changeBuilderStatus: this.changeBuilderStatus.bind(this),
            deleteBuilder: this.deleteBuilder.bind(this),
            changeSlugById: this.changeSlugById.bind(this),
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

    async createOrUpdateBuilder(req, res, next) {
        try {
            let CoLivingSpace = null;
            let message = 'Builder Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body)
                CoLivingSpace = await manageBuilderService.updateBuilder(forEdit)
                message = 'Builder Updated';
            } else {
                CoLivingSpace = await manageBuilderService.createBuilder(req.body)
            }
            res.status(200).json({
                message: message,
                data: CoLivingSpace
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

    async changeBuilderStatus(req, res, next) {
        try {
            const reqObject = Object.assign({}, req.params, req.body);
            await manageBuilderService.changeBuilderStatus(reqObject);
            res.status(200).json({
                message: 'Builder status updated'
            })
        } catch (error) {
            next(error)
        }
    }

    async deleteBuilder(req, res, next) {
        try {
            await manageBuilderService.deleteBuilder(req.params);
            res.status(200).json({
                message: 'Builder deleted successfully'
            })
        } catch (error) {
            next(error);
        }
    }

    async changeSlugById(req, res, next) {
        try {
            await manageBuilderService.changeSlugById(req.body);
            res.status(200).json({
                message: 'slug updated successfully'
            })
        } catch (error) {
            next(error);
        }
    }

    async addPriorityBuilder(req, res, next) {
        try {
            await manageBuilderService.addPriorityBuilder(req.body);
            res.status(200).json({
                message: 'Priority Spaces Added'
            })
        } catch (error) {
            next(error)
        }
    }

    async setPriorityByType(req, res, next) {
        try {
            await manageBuilderService.setPriorityByType(req.body);
            res.status(200).json({
                message: 'Set Priority Buiider'
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