import manageCoLivingSpaceService from '../../services/user/manage-co-living-space.js';
import _ from 'lodash';
class ManageCoLivingSpace {
    constructor() {
        return {
            getCoLivingSpaces: this.getCoLivingSpaces.bind(this),
            getCoLivingSpaceById: this.getCoLivingSpaceById.bind(this),
            getPriorityCoLivingSpaces: this.getPriorityCoLivingSpaces.bind(this),
            getPriorityCoLivingSpaces1: this.getPriorityCoLivingSpaces1.bind(this),
            // getPopularOfficeSpaces: this.getPopularOfficeSpaces.bind(this),
            // getSimilarPlacesByLocation: this.getSimilarPlacesByLocation.bind(this),
            getPopularPlacesByKey: this.getPopularPlacesByKey.bind(this),
            getPopularColivingSpacesCountryWise: this.getPopularColivingSpacesCountryWise.bind(this),
            getNearBySpaces: this.getNearBySpaces.bind(this)
        }
    }

    async getCoLivingSpaces(req, res, next) {
        try {
            const request = Object.assign({}, req.user, req.query);
            const result = await manageCoLivingSpaceService.getCoLivingSpaces(request);
            res.status(200).json({
                message: 'Co-Living Space list',
                data: result.coLivingSpaces,
                totalRecords: result.count,
                locations: result.googleResults
            })
        } catch (error) {
            next(error)
        }
    }

    async getCoLivingSpaceById(req, res, next) {
        try {
            const request = Object.assign({}, req.user, req.params);
            const result = await manageCoLivingSpaceService.getCoLivingSpaceById(request);
            res.status(200).json({
                message: 'Co-Living Space by Id',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async getPriorityCoLivingSpaces(req, res, next) {
        try {
            const result = await manageCoLivingSpaceService.getPriorityCoLivingSpaces(req.query);
            res.status(200).json({
                message: 'Priority Coliving List',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }
    
    async getPriorityCoLivingSpaces1(req, res, next) {
        try {
            const result = await manageCoLivingSpaceService.getPriorityCoLivingSpaces1(req.query);
            res.status(200).json({
                message: 'Priority Coliving List',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }
    async getNearBySpaces(req, res, next) {
        try {
            const  {limit, skip} = req.query;
            const result = await manageCoLivingSpaceService.getNearBySpaces(req.query);
            res.status(200).json({
                message: 'NearBy Coliving List',
                data: result.spaces.slice(skip, skip+limit),
                totalRecords: result.totalRecords
            })  
        } catch (error) {
            next(error)
        }
    }

    // async getPopularOfficeSpaces(req, res, next) {
    //     try {
    //         const result = await manageCoLivingSpaceService.getPopularOfficeSpaces();
    //         res.status(200).json({
    //             message: 'Popular OfficeSpaces List',
    //             data: result
    //         })
    //     } catch (error) {
    //         next(error)
    //     }
    // }

    // async getSimilarPlacesByLocation(req, res, next) {
    //     try {
    //         const request = Object.assign({}, req.query, req.params);
    //         const result = await manageCoLivingSpaceService.getSimilarPlacesByLocation(request);
    //         res.status(200).json({
    //             message: 'Similar OfficeSpaces List',
    //             data: result.similarPlaces,
    //             totalRecords: result.count
    //         })
    //     } catch (error) {
    //         next(error)
    //     }
    // }

    
    async getPopularPlacesByKey(req, res, next) {
        try {
          const  {limit, skip} = req.query;
            const result = await manageCoLivingSpaceService.getPopularPlacesByKey(req.query);
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
  
    
    

    async getPopularColivingSpacesCountryWise(req, res, next) {
        try {
            const result = await manageCoLivingSpaceService.getPopularColivingSpacesCountryWise(req.body);
            res.status(200).json({
                message: 'Popular colivings List',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }
}

export default new ManageCoLivingSpace();