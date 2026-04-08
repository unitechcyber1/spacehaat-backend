import manageOfficeSpaceService from '../../services/user/manage-office-space.js';
import _ from 'lodash';
class ManageOfficeSpace {
    constructor() {
        return {
            getOfficeSpaces: this.getOfficeSpaces.bind(this),
            getOfficeSpaceById: this.getOfficeSpaceById.bind(this),
            getPopularOfficeSpaces: this.getPopularOfficeSpaces.bind(this),
            getSimilarPlacesByLocation: this.getSimilarPlacesByLocation.bind(this),
            getPopularPlacesByKey: this.getPopularPlacesByKey.bind(this),
            getPriorityOfficeSpaces: this.getPriorityOfficeSpaces.bind(this),
            getNearBySpaces: this.getNearBySpaces.bind(this)
        }
    }

    async getOfficeSpaces(req, res, next) {
        try {
            const request = Object.assign({}, req.user, req.query);
            const result = await manageOfficeSpaceService.getOfficeSpaces(request);
            res.status(200).json({
                message: 'OfficeSpace list',
                data: result.officeSpaces,
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
            const result = await manageOfficeSpaceService.getNearBySpaces(req.query);
            res.status(200).json({
                message: 'NearBy OfficeSpace List',
                data: result.spaces.slice(skip, skip+limit),
                totalRecords: result.totalRecords
            })  
        } catch (error) {
            next(error)
        }
    }

    async getOfficeSpaceById(req, res, next) {
        try {
            const request = Object.assign({}, req.user, req.params);
            const result = await manageOfficeSpaceService.getOfficeSpaceById(request);
            res.status(200).json({
                message: 'OfficeSpace by officeId',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async getPopularOfficeSpaces(req, res, next) {
        try {
            const result = await manageOfficeSpaceService.getPopularOfficeSpaces();
            res.status(200).json({
                message: 'Popular OfficeSpaces List',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async getSimilarPlacesByLocation(req, res, next) {
        try {
            const request = Object.assign({}, req.query, req.params);
            const result = await manageOfficeSpaceService.getSimilarPlacesByLocation(request);
            res.status(200).json({
                message: 'Similar OfficeSpaces List',
                data: result.similarPlaces,
                totalRecords: result.count
            })
        } catch (error) {
            next(error)
        }
    }
    // async getPopularPlacesByKey(req, res, next) {
    //     try {
    //         const result = await manageOfficeSpaceService.getPopularPlacesByKey(req.query);
    //         res.status(200).json({
    //             message: 'popular OfficeSpaces List',
    //             data: result.officeSpaces,
    //             totalRecords: result.count
    //         })
    //     } catch (error) {
    //         next(error)
    //     }
    // }
    async getPopularPlacesByKey(req, res, next) {
        try {
          const  {limit, skip} = req.query;
            const result = await manageOfficeSpaceService.getPopularPlacesByKey(req.query);
            let finalcoLivingSpaces = [];
            // result.coLivingSpaces.forEach(element => {
            result.forEach(element => {
                let name = element.name
                let result = name.match(/Colive/);
                let Obj = _.find(finalcoLivingSpaces, function(o) {
                    return (o.id == element.id);
                });

                if (result == null && !Obj) {
                    finalcoLivingSpaces.push(element)
                }
            });
            res.status(200).json({
                message: 'popular coLivingSpaces List',
                data: finalcoLivingSpaces.slice(skip, skip+limit),
                totalRecords: finalcoLivingSpaces.length
            })
        } catch (error) {
            next(error)
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
}

export default new ManageOfficeSpace();