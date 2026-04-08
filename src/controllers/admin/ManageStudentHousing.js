import ManageStudentHousingSpaceService from '../../services/admin/manage-student-housing.js';
import FileUtility from '../../utilities/file.js';
import ManageExcel from '../../utilities/excelUpload.js';


class ManageStudentHousingSpace {
    constructor() {
        return {
            getStudentHousingSpaces: this.getStudentHousingSpaces.bind(this),
            getStudentHousingSpaceById: this.getStudentHousingSpaceById.bind(this),
            createOrUpdateStudentHousingSpace: this.createOrUpdateStudentHousingSpace.bind(this),
            changeStudentHousingSpaceStatus: this.changeStudentHousingSpaceStatus.bind(this),
            uploadBulkStudentHousingSpace: this.uploadBulkStudentHousingSpace.bind(this),
            // addPopularStudentHousingSpaces: this.addPopularStudentHousingSpaces.bind(this),
            // sortPopularStudentHousingSpaces: this.sortPopularStudentHousingSpaces.bind(this),
            deleteStudentHousingSpace: this.deleteStudentHousingSpace.bind(this),
            changeSlugById: this.changeSlugById.bind(this),
            addPriorityStudentHousingSpaces: this.addPriorityStudentHousingSpaces.bind(this),
            setPriorityByType: this.setPriorityByType.bind(this),
        }
    }

    async getStudentHousingSpaces(req, res, next) {
        try {
            const result = await ManageStudentHousingSpaceService.getStudentHousingSpaces(req.query);
            res.status(200).json({
                message: 'StudentHousing list',
                data: result.StudentHousings,
                totalRecords: result.count
            })
        } catch (error) {
            next(error)
        }
    }

    async createOrUpdateStudentHousingSpace(req, res, next) {
        try {
            let StudentHousingSpace = null;
            let message = 'StudentHousingSpace Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body)
                StudentHousingSpace = await ManageStudentHousingSpaceService.updateStudentHousingSpace(forEdit)
                message = 'StudentHousingSpace Updated';
            } else {
                StudentHousingSpace = await ManageStudentHousingSpaceService.createStudentHousingSpace(req.body)
            }
            res.status(200).json({
                message: message,
                data: StudentHousingSpace
            })
        } catch (error) {
            next(error)
        }
    }

    async getStudentHousingSpaceById(req, res, next) {
        try {
            const result = await ManageStudentHousingSpaceService.getStudentHousingSpaceById(req.params);
            res.status(200).json({
                message: 'StudentHousingSpace by Id',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async changeStudentHousingSpaceStatus(req, res, next) {
        try {
            const reqObject = Object.assign({}, req.params, req.body);
            await ManageStudentHousingSpaceService.changeStudentHousingSpaceStatus(reqObject);
            res.status(200).json({
                message: 'StudentHousingSpace status updated'
            })
        } catch (error) {
            next(error)
        }
    }

    async uploadBulkStudentHousingSpace(req, res, next) {
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
    //         await ManageStudentHousingSpaceService.addPopularOfficeSpaces(req.body);
    //         res.status(200).json({
    //             message: 'Popular Spaces Added'
    //         })
    //     } catch (error) {
    //         next(error)
    //     }
    // }

    // async sortPopularOfficeSpaces(req, res, next) {
    //     try {
    //         await ManageStudentHousingSpaceService.sortPopularOfficeSpaces(req.body);
    //         res.status(200).json({
    //             message: 'Popular Spaces Sorted'
    //         })
    //     } catch (error) {
    //         next(error)
    //     }
    // }

    async deleteStudentHousingSpace(req, res, next) {
        try {
            await ManageStudentHousingSpaceService.deleteStudentHousingSpace(req.params);
            res.status(200).json({
                message: 'StudentHousingSpace deleted successfully'
            })
        } catch (error) {
            next(error);
        }
    }

    async changeSlugById(req, res, next) {
        try {
            await ManageStudentHousingSpaceService.changeSlugById(req.body);
            res.status(200).json({
                message: 'slug updated successfully'
            })
        } catch (error) {
            next(error);
        }
    }

    async addPriorityStudentHousingSpaces(req, res, next) {
        try {
            await ManageStudentHousingSpaceService.addPriorityStudentHousingSpace(req.body);
            res.status(200).json({
                message: 'Priority Spaces Added'
            })
        } catch (error) {
            next(error)
        }
    }

    async setPriorityByType(req, res, next) {
        try {
            await ManageStudentHousingSpaceService.setPriorityByType(req.body);
            res.status(200).json({
                message: 'Set Priority StudentHousing Spaces'
            })
        } catch (error) {
            next(error)
        }
    }
}

export default new ManageStudentHousingSpace();