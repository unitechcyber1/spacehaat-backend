import ManageStudentHousingService from '../../services/user/manage-co-living-space.js';

class ManageStudentHousing {
    constructor() {
        return {
            getStudentHouseSpaces: this.getStudentHouseSpaces.bind(this),
            getStudentHouseSpaceById: this.getStudentHouseSpaceById.bind(this),
            getPriorityStudentHouseSpaces: this.getPriorityStudentHouseSpaces.bind(this),
            // getPopularOfficeSpaces: this.getPopularOfficeSpaces.bind(this),
            // getSimilarPlacesByLocation: this.getSimilarPlacesByLocation.bind(this),
            getPopularPlacesByKey: this.getPopularPlacesByKey.bind(this)
        }
    }

    async getStudentHouseSpaces(req, res, next) {
        try {
            const request = Object.assign({}, req.user, req.query);
            const result = await ManageStudentHousingService.getStudentHouseSpaces(request);
            let finalStudentHouseSpaces = [];
            result.StudentHouseSpaces.forEach(element => {
               let name = element.name
               let result = name.match(/Colive/);
               if(result == null){
                   finalStudentHouseSpaces.push(element)
               }
           });
            res.status(200).json({
                message: 'Co-Living Space list',
                data: finalStudentHouseSpaces,
                totalRecords: result.count,
                locations: result.googleResults
            })
        } catch (error) {
            next(error)
        }
    }

    async getStudentHouseSpaceById(req, res, next) {
        try {
            const request = Object.assign({}, req.user, req.params);
            const result = await ManageStudentHousingService.getStudentHouseSpaceById(request);
            res.status(200).json({
                message: 'Co-Living Space by Id',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async getPriorityStudentHouseSpaces(req, res, next) {
        try {
            const result = await ManageStudentHousingService.getPriorityStudentHouseSpaces(req.query);
            res.status(200).json({
                message: 'Priority Coliving List',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    // async getPopularOfficeSpaces(req, res, next) {
    //     try {
    //         const result = await ManageStudentHousingService.getPopularOfficeSpaces();
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
    //         const result = await ManageStudentHousingService.getSimilarPlacesByLocation(request);
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
           const result = await ManageStudentHousingService.getPopularPlacesByKey(req.query);
            let finalStudentHouseSpaces = [];
             result.StudentHouseSpaces.forEach(element => {
                let name = element.name
                let result = name.match(/Colive/);
                if(result == null){
                    finalStudentHouseSpaces.push(element)
                }
            });
            res.status(200).json({
                message: 'popular StudentHouseSpaces List',
                data: finalStudentHouseSpaces,
                totalRecords: result.count
            })
        } catch (error) {
            next(error)
        }
    }
}

export default new ManageStudentHousing();
