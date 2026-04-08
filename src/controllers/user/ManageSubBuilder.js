import manageSubBuilderService from '../../services/user/manage-subbuilder.js';

class ManageSubBuilder {
    constructor() {
        return {
            getSubBuilders: this.getSubBuilders.bind(this),
            getSubBuildersById: this.getSubBuildersById.bind(this),
            getApartmentForRentOrSale: this.getApartmentForRentOrSale.bind(this),
            getBuilderslocation: this.getBuilderslocation.bind(this)
        }
    }

    async getSubBuilders(req, res, next) {
        try {
            const  {limit, skip} = req.query;
            const result = await manageSubBuilderService.getSubBuilders(req.query);
            res.status(200).json({
                message: 'SubBuilder list',
                data: result.builders.slice(skip, skip+limit),
                totalRecords: result.count
            })
        } catch (error) {
            next(error)
        }
    }

    async getSubBuildersById(req, res, next) {
        try {
            const result = await manageSubBuilderService.getSubBuildersById(req.query);
            res.status(200).json({
                message: 'Sub Builder by Id',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async getApartmentForRentOrSale(req, res, next) {
        try {
            const result = await manageSubBuilderService.getApartmentForRentOrSale(req.query);
            res.status(200).json({
                message: 'ApartmentForRentOrSale list',
                data: result.builders,
                totalRecords: result.count
            })
        } catch (error) {
            next(error)
        }
    }
    async getBuilderslocation(req, res, next){
        try {
            const result = await manageSubBuilderService.getBuilderslocation(req.query);
            res.status(200).json({
                message: 'location list',
                data: result.location,
                // totalRecords: result.count
            })
        } catch (error) {
            next(error)
        }
    }

}

export default new ManageSubBuilder();