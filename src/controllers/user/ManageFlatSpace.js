import manageFlatSpaceService from '../../services/user/manage-flat-space.js';

class ManageFlatSpace {
    constructor() {
        return {
            getFlatSpaces: this.getFlatSpaces.bind(this),
            getFlatSpaceById: this.getFlatSpaceById.bind(this),
            getPriorityFlatSpaces: this.getPriorityFlatSpaces.bind(this),
            getPopularFlat: this.getPopularFlat.bind(this),
            getPopularFlatSpaces: this.getPopularFlatSpaces.bind(this),
            // getSimilarPlacesByLocation: this.getSimilarPlacesByLocation.bind(this),
            getPopularPlacesByKey: this.getPopularPlacesByKey.bind(this),
            getPopularFlatSpacesCountryWise: this.getPopularFlatSpacesCountryWise.bind(this)
        }
    }

    async getFlatSpaces(req, res, next) {
        try {
            const request = Object.assign({}, req.user, req.query);
            const result = await manageFlatSpaceService.getFlatSpaces(request);

            let finalFlatSpaces = [];
            result.FlatSpaces.forEach(element => {
                let name = element.name
                let result = name.match(/Colive/);

                if (result == null) {
                    finalFlatSpaces.push(element)
                }
            });
            res.status(200).json({
                message: 'FlatSpace list',
                data: finalFlatSpaces,
                totalRecords: result.count,
                locations: result.googleResults
            })
        } catch (error) {
            next(error)
        }
    }

    async getFlatSpaceById(req, res, next) {
        try {
            const request = Object.assign({}, req.user, req.params);
            const result = await manageFlatSpaceService.getFlatSpaceById(request);
            res.status(200).json({
                message: 'Co-Living Space by Id',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }
    async getPopularFlat(req, res, next) {
        try {
            const result = await manageFlatSpaceService.getPopularflatSpaces();
            res.status(200).json({
                message: 'Popular Flatspace List',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }
    async getPriorityFlatSpaces(req, res, next) {
        try {
            const result = await manageFlatSpaceService.getPriorityFlatSpaces(req.query);
            res.status(200).json({
                message: 'Priority Flat List',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async getPopularFlatSpaces(req, res, next) {
        try {
            const result = await manageFlatSpaceService.getPopularFlatSpaces();
            res.status(200).json({
                message: 'Popular FlatSpaces List',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    // async getSimilarPlacesByLocation(req, res, next) {
    //     try {
    //         const request = Object.assign({}, req.query, req.params);
    //         const result = await manageFlatSpaceService.getSimilarPlacesByLocation(request);
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
            const result = await manageFlatSpaceService.getPopularPlacesByKey(req.query);
            let finalFlatSpaces = [];
            result.FlatSpaces.forEach(element => {
                let name = element.name
                let result = name.match(/Colive/);
                if (result == null) {
                    finalFlatSpaces.push(element)
                }
            });
            res.status(200).json({
                message: 'popular FlatSpaces List',
                data: finalFlatSpaces,
                totalRecords: result.count
            })
        } catch (error) {
            next(error)
        }
    }
    async getPopularFlatSpacesCountryWise(req, res, next) {
        try {
            const result = await manageFlatSpaceService.getPopularFlatSpacesCountryWise(req.body);
            res.status(200).json({
                message: 'Popular Flats List',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

}

export default new ManageFlatSpace();