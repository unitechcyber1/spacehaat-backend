import manageOfficeSpaceService from '../../services/admin/manage-office-space.js';
import FileUtility from '../../utilities/file.js';
import ManageExcel from '../../utilities/excelUpload.js';


class ManageOfficeSpace {
    constructor() {
        return {
            getOfficeSpaces: this.getOfficeSpaces.bind(this),
            getOfficeSpaceById: this.getOfficeSpaceById.bind(this),
            userofficeSpaces: this.userofficeSpaces.bind(this),
            createOrUpdateOfficeSpace: this.createOrUpdateOfficeSpace.bind(this),
            addPopularOfficeSpaces: this.addPopularOfficeSpaces.bind(this),
            changeOfficeSpaceStatus: this.changeOfficeSpaceStatus.bind(this),
            uploadBulkOfficeSpace: this.uploadBulkOfficeSpace.bind(this),
            sortPopularOfficeSpaces: this.sortPopularOfficeSpaces.bind(this),
            deleteOfficeSpace: this.deleteOfficeSpace.bind(this),
            changeSlugById: this.changeSlugById.bind(this),
            getPriorityOfficeSpaces: this.getPriorityOfficeSpaces.bind(this),
            addPriorityOfficeSpaces: this.addPriorityOfficeSpaces.bind(this),
            setPriorityByType: this.setPriorityByType.bind(this),
            changeProjectOrder: this.changeProjectOrder.bind(this),
            getProjectbyMicrolocationWithPriority: this.getProjectbyMicrolocationWithPriority.bind(this),
            spaceOrderByDrag: this.spaceOrderByDrag.bind(this),
            changeProjectOrderbyDrag: this.changeProjectOrderbyDrag.bind(this)
        }
    }

    async getOfficeSpaces(req, res, next) {
        try {
            const result = await manageOfficeSpaceService.getOfficeSpaces(req.query);
            res.status(200).json({
                message: 'OfficeSpace list',
                data: result.officeSpaces,
                totalRecords: result.count
            })
        } catch (error) {
            next(error)
        }
    }
    async changeProjectOrder(req, res, next) {
        try {
            const reqObject = Object.assign({}, req.params, req.body);
            await manageOfficeSpaceService.changeProjectOrder(reqObject);
            res.status(200).json({
                message: 'OfficeSpace priority updated'
            })
        } catch (error) {
            next(error)
        }
    }
    async getProjectbyMicrolocationWithPriority(req, res, next) {
        try {
            const result = await manageOfficeSpaceService.getProjectbyMicrolocationWithPriority(req.params);
            res.status(200).json({
                message: 'Priority OfficeSpace by Id',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }
    async changeProjectOrderbyDrag(req, res, next) {
        try {
            await manageOfficeSpaceService.changeProjectOrderbyDrag(req.body);
            res.status(200).json({
                message: 'Priority OfficeSpace Spaces updated successfully'
            })
        } catch (error) {
            next(error)
        }
    }
    async spaceOrderByDrag(req, res, next) {
        try {
            await manageOfficeSpaceService.spaceOrderByDrag(req.body);
            res.status(200).json({
                message: 'Set Priority OfficeSpace Spaces'
            })
        } catch (error) {
            next(error)
        }
    }
    async createOrUpdateOfficeSpace(req, res, next) {
        try {
            let officeSpace = null;
            let message = 'OfficeSpace Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body)
                officeSpace = await manageOfficeSpaceService.updateOfficeSpace(forEdit)
                message = 'OfficeSpace Updated';
            } else {
                officeSpace = await manageOfficeSpaceService.createOfficeSpace(req.body)
            }
            res.status(200).json({
                message: message,
                data: officeSpace
            })
        } catch (error) {
            next(error)
        }
    }

    async getOfficeSpaceById(req, res, next) {
        try {
            const result = await manageOfficeSpaceService.getOfficeSpaceById(req.params);
            res.status(200).json({
                message: 'OfficeSpace by workId',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async userofficeSpaces(req, res, next) {
        try {
            const result = await manageOfficeSpaceService.userofficeSpaces(req.params);
            res.status(200).json({
                message: 'OfficeSpace by workId',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async changeOfficeSpaceStatus(req, res, next) {
        try {
            const reqObject = Object.assign({}, req.params, req.body);
            await manageOfficeSpaceService.changeOfficeSpaceStatus(reqObject);
            res.status(200).json({
                message: 'OfficeSpace status updated'
            })
        } catch (error) {
            next(error)
        }
    }

    async uploadBulkOfficeSpace(req, res, next) {
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

    async addPopularOfficeSpaces(req, res, next) {
        try {
            await manageOfficeSpaceService.addPopularOfficeSpaces(req.body);
            res.status(200).json({
                message: 'Popular Spaces Added'
            })
        } catch (error) {
            next(error)
        }
    }

    async sortPopularOfficeSpaces(req, res, next) {
        try {
            await manageOfficeSpaceService.sortPopularOfficeSpaces(req.body);
            res.status(200).json({
                message: 'Popular Spaces Sorted'
            })
        } catch (error) {
            next(error)
        }
    }

    async deleteOfficeSpace(req, res, next) {
        try {
            await manageOfficeSpaceService.deleteOfficeSpace(req.params);
            res.status(200).json({
                message: 'OfficeSpace deleted successfully'
            })
        } catch (error) {
            next(error);
        }
    }

    async changeSlugById(req, res, next) {
        try {
            await manageOfficeSpaceService.changeSlugById(req.body);
            res.status(200).json({
                message: 'slug updated successfully'
            })
        } catch (error) {
            next(error);
        }
    }

    async getPriorityOfficeSpaces(req, res, next) {
        try {
            const result = await manageOfficeSpaceService.getPriorityOfficeSpaces(req.query);
            res.status(200).json({
                message: 'Priority Office List',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async addPriorityOfficeSpaces(req, res, next) {
        try {
            await manageOfficeSpaceService.addPriorityOfficeSpace(req.body);
            res.status(200).json({
                message: 'Priority Spaces Added'
            })
        } catch (error) {
            next(error)
        }
    }

    async setPriorityByType(req, res, next) {
        try {
            await manageOfficeSpaceService.setPriorityByType(req.body);
            res.status(200).json({
                message: 'Set Priority Office Spaces'
            })
        } catch (error) {
            next(error)
        }
    }

}

export default new ManageOfficeSpace();