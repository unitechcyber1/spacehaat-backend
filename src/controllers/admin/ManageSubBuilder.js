import manageSubBuilderService from '../../services/admin/manage-subbuilder.js';

class ManageSubBuilder {
    constructor() {
        return {
            getSubBuilders: this.getSubBuilders.bind(this),
            getSubBuildersById: this.getSubBuildersById.bind(this),
            createOrUpdateBuilder: this.createOrUpdateBuilder.bind(this),
            addPrioritySubBuilder: this.addPrioritySubBuilder.bind(this),
            setPriorityByType: this.setPriorityByType.bind(this),
            changeSubBuilderStatus: this.changeSubBuilderStatus.bind(this),
            deleteSubBuilder: this.deleteSubBuilder.bind(this),
            changeSlugById: this.changeSlugById.bind(this),
            getPriorityBuilders: this.getPriorityBuilders.bind(this),
            spaceOrderByDrag: this.spaceOrderByDrag.bind(this)
        }
    }

    async getSubBuilders(req, res, next) {
        try {
            const result = await manageSubBuilderService.getSubBuilders(req.query);
            res.status(200).json({
                message: 'SubBuilder list',
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
            let message = 'Sub Builder Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body)
                CoLivingSpace = await manageSubBuilderService.updateSubBuilder(forEdit)
                message = 'Sub Builder Updated';
            } else {
                CoLivingSpace = await manageSubBuilderService.createSubBuilder(req.body)
            }
            res.status(200).json({
                message: message,
                data: CoLivingSpace
            })
        } catch (error) {
            next(error)
        }
    }

    async getSubBuildersById(req, res, next) {
        try {
            const result = await manageSubBuilderService.getSubBuildersById(req.params);
            res.status(200).json({
                message: 'Sub Builder by Id',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }
    async spaceOrderByDrag(req, res, next) {
        try {
            await manageSubBuilderService.spaceOrderByDrag(req.body);
            res.status(200).json({
                message: 'Set Priority Buidings'
            })
        } catch (error) {
            next(error)
        }
    }
    async changeSubBuilderStatus(req, res, next) {
        try {
            const reqObject = Object.assign({}, req.params, req.body);
            await manageSubBuilderService.changeSubBuilderStatus(reqObject);
            res.status(200).json({
                message: 'Sub Builder status updated'
            })
        } catch (error) {
            next(error)
        }
    }

    async deleteSubBuilder(req, res, next) {
        try {
            await manageSubBuilderService.deleteSubBuilder(req.params);
            res.status(200).json({
                message: 'Sub Builder deleted successfully'
            })
        } catch (error) {
            next(error);
        }
    }

    async changeSlugById(req, res, next) {
        try {
            await manageSubBuilderService.changeSlugById(req.body);
            res.status(200).json({
                message: 'slug updated successfully'
            })
        } catch (error) {
            next(error);
        }
    }

    async addPrioritySubBuilder(req, res, next) {
        try {
            await manageSubBuilderService.addPrioritySubBuilder(req.body);
            res.status(200).json({
                message: 'Priority Spaces Added'
            })
        } catch (error) {
            next(error)
        }
    }

    async setPriorityByType(req, res, next) {
        try {
            await manageSubBuilderService.setPriorityByType(req.body);
            res.status(200).json({
                message: 'Set Priority Buiider'
            })
        } catch (error) {
            next(error)
        }
    }
    async getPriorityBuilders(req, res, next) {
        try {
            const result = await manageSubBuilderService.getPriorityBuilders(req.query);
            res.status(200).json({
                message: 'Priority Buildings List',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }
}

export default new ManageSubBuilder();