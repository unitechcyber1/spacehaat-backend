import manageWorkSpaceService from '../../services/user/manage-work-space.js';

class ManageWorkSpace {
    constructor() {
        return {
            getWorkSpaces: this.getWorkSpaces.bind(this),
            getWorkSpaces_country_wise: this.getWorkSpaces_country_wise.bind(this),
            getWorkSpaceById: this.getWorkSpaceById.bind(this),
            getPopularWorkSpaces: this.getPopularWorkSpaces.bind(this),
            getPopularWorkSpacesCountryWise: this.getPopularWorkSpacesCountryWise.bind(this),
            getWorkSpacesCountryWise: this.getWorkSpacesCountryWise.bind(this),
            getPriorityWorkSpaces: this.getPriorityWorkSpaces.bind(this),
            getSimilarPlacesByLocation: this.getSimilarPlacesByLocation.bind(this),
            getPopularPlacesByKey: this.getPopularPlacesByKey.bind(this),
            getNearBySpaces: this.getNearBySpaces.bind(this)
        }
    }

    async getWorkSpaces(req, res, next) {
        try {
            const request = Object.assign({}, req.user, req.query);
            const result = await manageWorkSpaceService.getWorkSpaces(request);
            res.status(200).json({
                message: 'WorkSpace list',
                data: result.workSpaces,
                totalRecords: result.count,
                locations: result.googleResults
            })
        } catch (error) {
            next(error)
        }
    }
    async getNearBySpaces(req, res, next) {
        try {
            const  {limit, skip} = req.query;
            const result = await manageWorkSpaceService.getNearBySpaces(req.query);
            res.status(200).json({
                message: 'NearBy workspace List',
                data: result.spaces.slice(skip, skip+limit),
                totalRecords: result.totalRecords
            })  
        } catch (error) {
            next(error)
        }
    }
    async getWorkSpaces_country_wise(req, res, next) {
        try {
            const request = Object.assign({}, req.user, req.query, req.body);
            const result = await manageWorkSpaceService.getWorkSpaces_country_wise(request);
            res.status(200).json({
                message: 'WorkSpace list',
                data: result.workSpaces,
                totalRecords: result.count,
                locations: result.googleResults
            })
        } catch (error) {
            next(error)
        }
    }

    async getWorkSpaceById(req, res, next) {
        try {
            const request = Object.assign({}, req.user, req.params);
            const result = await manageWorkSpaceService.getWorkSpaceById(request);
            res.status(200).json({
                message: 'WorkSpace by workId',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async getPopularWorkSpaces(req, res, next) {
        try {
            const result = await manageWorkSpaceService.getPopularWorkSpaces();
            res.status(200).json({
                message: 'Popular workSpaces List',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }
    async getPopularWorkSpacesCountryWise(req, res, next) {
        try {
            const result = await manageWorkSpaceService.getPopularWorkSpacesCountryWise(req.body);
            res.status(200).json({
                message: 'Popular workSpaces List',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }
    async getWorkSpacesCountryWise(req, res, next) {
        try {
            const result = await manageWorkSpaceService.getWorkSpacesCountryWise(req.body);
            res.status(200).json({
                message: 'Popular workSpaces List',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async getPriorityWorkSpaces(req, res, next) {
        try {
            const result = await manageWorkSpaceService.getPriorityWorkSpaces(req.query);
            res.status(200).json({
                message: 'Priority workSpaces List',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async getSimilarPlacesByLocation(req, res, next) {
        try {
            const request = Object.assign({}, req.query, req.params);
            const result = await manageWorkSpaceService.getSimilarPlacesByLocation(request);
            res.status(200).json({
                message: 'Similar workSpaces List',
                data: result.similarPlaces,
                totalRecords: result.count
            })
        } catch (error) {
            next(error)
        }
    }
    async getPopularPlacesByKey(req, res, next) {
        try {
            const  {limit, skip} = req.query;
            const result = await manageWorkSpaceService.getPopularPlacesByKey(req.query);
            res.status(200).json({
                message: 'popular workSpaces List',
                data: result.workSpaces.slice(skip, skip+limit),
                totalRecords: result.count
            })
        } catch (error) {
            next(error)
        }
    }
}

export default new ManageWorkSpace();