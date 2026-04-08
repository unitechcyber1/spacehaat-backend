import manageCoLivingSpaceService from '../../services/admin/manage-co-living-space.js';
import FileUtility from '../../utilities/file.js';
import ManageExcel from '../../utilities/excelUpload.js';


class ManageCoLivingSpace {
    constructor() {
        return {
            getCoLivingSpaces: this.getCoLivingSpaces.bind(this),
            getCoLivingSpaceById: this.getCoLivingSpaceById.bind(this),
            getUserCoLivingSpaceById: this.getUserCoLivingSpaceById.bind(this),
            createOrUpdateCoLivingSpace: this.createOrUpdateCoLivingSpace.bind(this),
            changeCoLivingSpaceStatus: this.changeCoLivingSpaceStatus.bind(this),
            uploadBulkCoLivingSpace: this.uploadBulkCoLivingSpace.bind(this),
            // addPopularCoLivingSpaces: this.addPopularCoLivingSpaces.bind(this),
            // sortPopularCoLivingSpaces: this.sortPopularCoLivingSpaces.bind(this),
            deleteCoLivingSpace: this.deleteCoLivingSpace.bind(this),
            changeSlugById: this.changeSlugById.bind(this),
            addPriorityCoLivingSpaces: this.addPriorityCoLivingSpaces.bind(this),
            setPriorityByType: this.setPriorityByType.bind(this),
            spaceOrderByDrag: this.spaceOrderByDrag.bind(this),
            changeProjectOrderbyDrag: this.changeProjectOrderbyDrag.bind(this),
            changeProjectOrder: this.changeProjectOrder.bind(this),
            getProjectbyMicrolocationWithPriority: this.getProjectbyMicrolocationWithPriority.bind(this)
        }
    }

    async getCoLivingSpaces(req, res, next) {
        try {
            const result = await manageCoLivingSpaceService.getCoLivingSpaces(req.query);
            res.status(200).json({
                message: 'CoLiving list',
                data: result.coLivingSpaces,
                totalRecords: result.count
            })
        } catch (error) {
            next(error)
        }
    }

    async createOrUpdateCoLivingSpace(req, res, next) {
        try {
            let CoLivingSpace = null;
            let message = 'CoLivingSpace Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body)
                CoLivingSpace = await manageCoLivingSpaceService.updateCoLivingSpace(forEdit)
                message = 'CoLivingSpace Updated';
            } else {
                CoLivingSpace = await manageCoLivingSpaceService.createCoLivingSpace(req.body)
            }
            res.status(200).json({
                message: message,
                data: CoLivingSpace
            })
        } catch (error) {
            next(error)
        }
    }

    async getCoLivingSpaceById(req, res, next) {
        try {
            const result = await manageCoLivingSpaceService.getCoLivingSpaceById(req.params);
            res.status(200).json({
                message: 'CoLivingSpace by Id',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async getUserCoLivingSpaceById(req, res, next) {
        try {
            const result = await manageCoLivingSpaceService.getUserCoLivingSpaceById(req.params);
            res.status(200).json({
                message: 'CoLivingSpace by Id',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async changeCoLivingSpaceStatus(req, res, next) {
        try {
            const reqObject = Object.assign({}, req.params, req.body);
            await manageCoLivingSpaceService.changeCoLivingSpaceStatus(reqObject);
            res.status(200).json({
                message: 'CoLivingSpace status updated'
            })
        } catch (error) {
            next(error)
        }
    }
    async changeProjectOrder(req, res, next) {
        try {
            const reqObject = Object.assign({}, req.params, req.body);
            await manageCoLivingSpaceService.changeProjectOrder(reqObject);
            res.status(200).json({
                message: 'CoLivingSpace priority updated'
            })
        } catch (error) {
            next(error)
        }
    }

    async uploadBulkCoLivingSpace(req, res, next) {
        try {
            const { file } = req.files;
            const { type } = req.body;
            const fileDetails = await FileUtility.saveFile({ file }, type, 'excel');
            const data = await ManageExcel.fileProcessing(fileDetails, 'office_space');
            res.status(200).json({
                message: 'file uploaded successfully',
                data
            });
        } catch (error) {
            next(error)
        }
    }

    // async addPopularOfficeSpaces(req, res, next) {
    //     try {
    //         await manageCoLivingSpaceService.addPopularOfficeSpaces(req.body);
    //         res.status(200).json({
    //             message: 'Popular Spaces Added'
    //         })
    //     } catch (error) {
    //         next(error)
    //     }
    // }

    // async sortPopularOfficeSpaces(req, res, next) {
    //     try {
    //         await manageCoLivingSpaceService.sortPopularOfficeSpaces(req.body);
    //         res.status(200).json({
    //             message: 'Popular Spaces Sorted'
    //         })
    //     } catch (error) {
    //         next(error)
    //     }
    // }

    async deleteCoLivingSpace(req, res, next) {
        try {
            await manageCoLivingSpaceService.deleteCoLivingSpace(req.params);
            res.status(200).json({
                message: 'CoLivingSpace deleted successfully'
            })
        } catch (error) {
            next(error);
        }
    }

    async changeSlugById(req, res, next) {
        try {
            await manageCoLivingSpaceService.changeSlugById(req.body);
            res.status(200).json({
                message: 'slug updated successfully'
            })
        } catch (error) {
            next(error);
        }
    }
    async getProjectbyMicrolocationWithPriority(req, res, next) {
        try {
            const result = await manageCoLivingSpaceService.getProjectbyMicrolocationWithPriority(req.params);
            res.status(200).json({
                message: 'Priority CoLivingSpace by Id',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async addPriorityCoLivingSpaces(req, res, next) {
        try {
            await manageCoLivingSpaceService.addPriorityCoLivingSpace(req.body);
            res.status(200).json({
                message: 'Priority Spaces Added'
            })
        } catch (error) {
            next(error)
        }
    }

    async setPriorityByType(req, res, next) {
        try {
            await manageCoLivingSpaceService.setPriorityByType(req.body);
            res.status(200).json({
                message: 'Set Priority Coliving Spaces'
            })
        } catch (error) {
            next(error)
        }
    }
    async spaceOrderByDrag(req, res, next) {
        try {
            await manageCoLivingSpaceService.spaceOrderByDrag(req.body);
            res.status(200).json({
                message: 'Set Priority Coliving Spaces'
            })
        } catch (error) {
            next(error)
        }
    }
    async changeProjectOrderbyDrag(req, res, next) {
        try {
            await manageCoLivingSpaceService.changeProjectOrderbyDrag(req.body);
            res.status(200).json({
                message: 'Priority Coliving Spaces updated successfully'
            })
        } catch (error) {
            next(error)
        }
    }
}

export default new ManageCoLivingSpace();