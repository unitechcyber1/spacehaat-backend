import manageFlatSpaceService from '../../services/admin/manage-flat-space.js';
import FileUtility from '../../utilities/file.js';
import ManageExcel from '../../utilities/excelUpload.js';


class ManageFlatSpace {
    constructor() {
        return {
            getFlatSpaces: this.getFlatSpaces.bind(this),
            getFlatSpaceById: this.getFlatSpaceById.bind(this),
            getuserFlatSpaceById: this.getuserFlatSpaceById.bind(this),
            createOrUpdateFlatSpace: this.createOrUpdateFlatSpace.bind(this),
            changeFlatSpaceStatus: this.changeFlatSpaceStatus.bind(this),
            uploadBulkFlatSpace: this.uploadBulkFlatSpace.bind(this),
            addPopularFlatSpaces: this.addPopularFlatSpaces.bind(this),
            sortPopularFlatSpaces: this.sortPopularFlatSpaces.bind(this),
            deleteFlatSpace: this.deleteFlatSpace.bind(this),
            changeSlugById: this.changeSlugById.bind(this),
            addPriorityFlatSpaces: this.addPriorityFlatSpaces.bind(this),
            setPriorityByType: this.setPriorityByType.bind(this),
        }
    }

    async getFlatSpaces(req, res, next) {
        try {
            const result = await manageFlatSpaceService.getFlatSpaces(req.query);
            res.status(200).json({
                message: 'Flat list',
                data: result.FlatSpaces,
                totalRecords: result.count
            })
        } catch (error) {
            next(error)
        }
    }

    async createOrUpdateFlatSpace(req, res, next) {
        try {
            let FlatSpace = null;
            let message = 'FlatSpace Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body)
                FlatSpace = await manageFlatSpaceService.updateFlatSpace(forEdit)
                message = 'FlatSpace Updated';
            } else {
                FlatSpace = await manageFlatSpaceService.createFlatSpace(req.body)
            }
            res.status(200).json({
                message: message,
                data: FlatSpace
            })
        } catch (error) {
            next(error)
        }
    }

    async getFlatSpaceById(req, res, next) {
        try {
            const result = await manageFlatSpaceService.getFlatSpaceById(req.params);
            res.status(200).json({
                message: 'FlatSpace by Id',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async getuserFlatSpaceById(req, res, next) {
        try {
            const result = await manageFlatSpaceService.getuserFlatSpaceById(req.params);
            res.status(200).json({
                message: 'FlatSpace by Id',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async changeFlatSpaceStatus(req, res, next) {
        try {
            const reqObject = Object.assign({}, req.params, req.body);
            await manageFlatSpaceService.changeFlatSpaceStatus(reqObject);
            res.status(200).json({
                message: 'FlatSpace status updated'
            })
        } catch (error) {
            next(error)
        }
    }

    async uploadBulkFlatSpace(req, res, next) {
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
    async addPopularFlatSpaces(req, res, next) {
            try {
                await manageFlatSpaceService.addPopularFlatSpaces(req.body);
                res.status(200).json({
                    message: 'Popular Spaces Added'
                })
            } catch (error) {
                next(error)
            }
        }
        // async addPopularOfficeSpaces(req, res, next) {
        //     try {
        //         await manageFlatSpaceService.addPopularOfficeSpaces(req.body);
        //         res.status(200).json({
        //             message: 'Popular Spaces Added'
        //         })
        //     } catch (error) {
        //         next(error)
        //     }
        // }


    async sortPopularFlatSpaces(req, res, next) {
        try {
            await manageFlatSpaceService.sortPopularFlatSpaces(req.body);
            res.status(200).json({
                message: 'Popular Spaces Sorted'
            })
        } catch (error) {
            next(error)
        }
    }
    async deleteFlatSpace(req, res, next) {
        try {
            await manageFlatSpaceService.deleteFlatSpace(req.params);
            res.status(200).json({
                message: 'FlatSpace deleted successfully'
            })
        } catch (error) {
            next(error);
        }
    }

    async changeSlugById(req, res, next) {
        try {
            await manageFlatSpaceService.changeSlugById(req.body);
            res.status(200).json({
                message: 'slug updated successfully'
            })
        } catch (error) {
            next(error);
        }
    }

    async addPriorityFlatSpaces(req, res, next) {
        try {
            await manageFlatSpaceService.addPriorityFlatSpace(req.body);
            res.status(200).json({
                message: 'Priority Spaces Added'
            })
        } catch (error) {
            next(error)
        }
    }

    async setPriorityByType(req, res, next) {
        try {
            await manageFlatSpaceService.setPriorityByType(req.body);
            res.status(200).json({
                message: 'Set Priority Flat Spaces'
            })
        } catch (error) {
            next(error)
        }
    }
}

export default new ManageFlatSpace();