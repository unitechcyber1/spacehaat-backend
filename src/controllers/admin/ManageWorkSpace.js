import manageWorkSpaceService from '../../services/admin/manage-work-space.js';
import FileUtility from '../../utilities/file.js';
import ManageExcel from '../../utilities/excelUpload.js';


class ManageWorkSpace {
    constructor() {
        return {
            getWorkSpaces: this.getWorkSpaces.bind(this),
            allSpacesAddedBySellerAccount: this.allSpacesAddedBySellerAccount.bind(this),
            getWorkSpaceById: this.getWorkSpaceById.bind(this),
            getuserWorkSpaceById: this.getuserWorkSpaceById.bind(this),
            createOrUpdateWorkSpace: this.createOrUpdateWorkSpace.bind(this),
            changeWorkSpaceStatus: this.changeWorkSpaceStatus.bind(this),
            uploadBulkWorkSpace: this.uploadBulkWorkSpace.bind(this),
            addPopularWorkSpaces: this.addPopularWorkSpaces.bind(this),
            addPriorityWorkSpaces: this.addPriorityWorkSpaces.bind(this),
            sortPopularWorkSpaces: this.sortPopularWorkSpaces.bind(this),
            setPriorityByType: this.setPriorityByType.bind(this),
            deleteWorkSpace: this.deleteWorkSpace.bind(this),
            updatePlanProperty: this.updatePlanProperty.bind(this),
            changeSlugById: this.changeSlugById.bind(this),
            totalProperties: this.totalProperties.bind(this),
            spaceOrderByDrag: this.spaceOrderByDrag.bind(this),
            updateCalendar: this.updateCalendar.bind(this),
            listingAccess: this.listingAccess.bind(this)
        }
    }
    async listingAccess(req, res, next) {
        try {
            await manageWorkSpaceService.listingAccess(req.body);
            console.log('sasaasax',req.body)
            res.status(200).json({
                message: 'Access updated successfully'
            })
        } catch (error) {
            next(error)
        }
    }


    async getWorkSpaces(req, res, next) {
        try {
            const result = await manageWorkSpaceService.getWorkSpaces(req.query);
            res.status(200).json({
                message: 'WorkSpace list',
                data: result.workSpaces,
                totalRecords: result.count
            })
        } catch (error) {
            next(error)
        }
    }

    async allSpacesAddedBySellerAccount(req, res, next) {
        try {
            const result = await manageWorkSpaceService.allSpacesAddedBySellerAccount(req.query);
            res.status(200).json({
                message: 'AllSpaces list',
                data: result.allSpacesList,
                totalRecords: result.count
            })
        } catch (error) {
            next(error)
        }
    }

    async totalProperties(req, res, next) {
        try {
            const result = await manageWorkSpaceService.totalProperties(req.query);
            res.status(200).json({
                message: 'Total Properties count',
                totalRecords: result.count
            })
        } catch (error) {
            next(error)
        }
    }

    async createOrUpdateWorkSpace(req, res, next) {
        try {
            let workSpace = null;
            let message = 'WorkSpace Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body)
                workSpace = await manageWorkSpaceService.updateWorkSpace(forEdit)
                message = 'WorkSpace Updated';
            } else {
                workSpace = await manageWorkSpaceService.createWorkSpace(req.body)
            }
            res.status(200).json({
                message: message,
                data: workSpace
            })
        } catch (error) {
            next(error)
        }
    }

    async getWorkSpaceById(req, res, next) {
        try {
            const result = await manageWorkSpaceService.getWorkSpaceById(req.params);
            res.status(200).json({
                message: 'WorkSpace by workId',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async getuserWorkSpaceById(req, res, next) {
        try {
            const result = await manageWorkSpaceService.getuserWorkSpaceById(req.params);
            res.status(200).json({
                message: 'WorkSpace by workId',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async changeWorkSpaceStatus(req, res, next) {
        try {
            const reqObject = Object.assign({}, req.params, req.body);
            await manageWorkSpaceService.changeWorkSpaceStatus(reqObject);
            res.status(200).json({
                message: 'WorkSpace status updated'
            })
        } catch (error) {
            next(error)
        }
    }

    async uploadBulkWorkSpace(req, res, next) {
        try {
            const { file } = req.files;
            const { type } = req.body;
            const fileDetails = await FileUtility.saveFile({ file }, type, 'excel');
            const data = await ManageExcel.fileProcessing(fileDetails);
            res.status(200).json({
                message: 'file uploaded successfully',
                data
            });
        } catch (error) {
            next(error)
        }
    }
    async updateCalendar(req, res, next) {
        try {
            await manageWorkSpaceService.updateCalendar(req.body);
            res.status(200).json({
                message: 'Calendar Updated'
            })
        } catch (error) {
            next(error)
        }
    }

    async addPopularWorkSpaces(req, res, next) {
        try {
            await manageWorkSpaceService.addPopularWorkSpaces(req.body);
            res.status(200).json({
                message: 'Popular Spaces Added'
            })
        } catch (error) {
            next(error)
        }
    }

    async addPriorityWorkSpaces(req, res, next) {
        try {
            await manageWorkSpaceService.addPriorityWorkSpaces(req.body);
            res.status(200).json({
                message: 'Priority Spaces Added'
            })
        } catch (error) {
            next(error)
        }
    }

    async sortPopularWorkSpaces(req, res, next) {
        try {
            await manageWorkSpaceService.sortPopularWorkSpaces(req.body);
            res.status(200).json({
                message: 'Popular Spaces Sorted'
            })
        } catch (error) {
            next(error)
        }
    }

    async setPriorityByType(req, res, next) {
        try {
            await manageWorkSpaceService.setPriorityByType(req.body);
            res.status(200).json({
                message: 'Set Priority Workspace Spaces'
            })
        } catch (error) {
            next(error)
        }
    }

    async deleteWorkSpace(req, res, next) {
        try {
            await manageWorkSpaceService.deleteWorkSpace(req.params);
            res.status(200).json({
                message: 'Workspace deleted successfully'
            })
        } catch (error) {
            next(error);
        }
    }

    async updatePlanProperty(req, res, next) {
        try {
            const result = await manageWorkSpaceService.updatePlanProperty(req.params);
            res.status(200).json({
                message: 'Workspace updated new property'
            })
        } catch (error) {
            next(error);
        }
    }

    async changeSlugById(req, res, next) {
        try {
            await manageWorkSpaceService.changeSlugById(req.body);
            res.status(200).json({
                message: 'slug updated successfully'
            })
        } catch (error) {
            next(error);
        }
    }
    async spaceOrderByDrag(req, res, next) {
        try {
            await manageWorkSpaceService.spaceOrderByDrag(req.body);
            res.status(200).json({
                message: 'Set Priority Coliving Spaces'
            })
        } catch (error) {
            next(error)
        }
    }

}

export default new ManageWorkSpace();