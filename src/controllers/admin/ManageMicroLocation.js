import manageMicroLocationService from '../../services/admin/manage-micro-location.js';

class ManageMicroLocation {
    constructor() {
        return {
            getMicroLocations: this.getMicroLocations.bind(this),
            getMicroLocationById: this.getMicroLocationById.bind(this),
            addOrEditMicroLocation: this.addOrEditMicroLocation.bind(this),
            toggleMicroLocationStatus: this.toggleMicroLocationStatus.bind(this),
            getMicroLocationByCity: this.getMicroLocationByCity.bind(this),
            deleteMicroLocation: this.deleteMicroLocation.bind(this),
            microLocationByCityAndSpaceType: this.microLocationByCityAndSpaceType.bind(this),
            setPriorityByType: this.setPriorityByType.bind(this),
            getPriorityMicrolocations: this.getPriorityMicrolocations.bind(this),
            addPriorityMicrolocations: this.addPriorityMicrolocations.bind(this),
            locationOrderByDrag: this.locationOrderByDrag.bind(this)
        }
    }

    async getMicroLocations(req, res, next) {
        try {
            const result = await manageMicroLocationService.getMicroLocations(req.query);
            return res.status(200).json({
                message: "Micro Location List",
                data: result.microLocations,
                totalRecords: result.count
            })
        } catch (e) {
            next(e)
        }
    }

    async getMicroLocationById(req, res, next) {
        try {
            const microLocation = await manageMicroLocationService.getMicroLocationById(req.params);
            res.status(200).json({
                message: 'get Micro Location by id',
                data: microLocation
            })
        } catch (error) {
            next(error);
        }
    }

    async microLocationByCityAndSpaceType(req, res, next) {
        try {
            const result = await manageMicroLocationService.microLocationByCityAndSpaceType(req.query);
            res.status(200).json({
                message: 'get Micro Location by city and space type',
                data: result.microLocations,
                totleRecords: result.count,
            })
        } catch (error) {
            next(error);
        }
    }

    async addOrEditMicroLocation(req, res, next) {
        try {
            let microLocation = null;
            let message = 'Micro Location Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body);
                microLocation = await manageMicroLocationService.updateMicroLocation(forEdit);
                message = 'Micro Location Updated';
            } else {
                microLocation = await manageMicroLocationService.addMicroLocation(req.body);
            }
            res.status(200).json({
                message,
                data: microLocation
            });
        } catch (error) {
            next(error)
        }
    }

    async toggleMicroLocationStatus(req, res, next) {
        try {
            await manageMicroLocationService.toggleMicroLocationStatus(req.params);
            return res.status(200).json({
                message: "Micro Location Status Changed"
            })
        } catch (e) {
            next(e)
        }
    }

    async getMicroLocationByCity(req, res, next) {
        try {
            const microLocations = await manageMicroLocationService.getMicroLocationByCity(req.params);
            return res.status(200).json({
                message: "Micro Locations by city",
                data: microLocations
            })
        } catch (e) {
            next(e)
        }
    }

    async deleteMicroLocation(req, res, next) {
        try {
            await manageMicroLocationService.deleteMicroLocation(req.params);
            res.status(200).json({
                message: 'Micro Location deleted'
            })
        } catch (error) {
            next(error);
        }
    }

    async setPriorityByType(req, res, next) {
        try {
            await manageMicroLocationService.setPriorityByType(req.body);
            res.status(200).json({
                message: 'Set Priority Microlocation'
            })
        } catch (error) {
            next(error)
        }
    }
   async locationOrderByDrag(req, res, next){
    try {
        await manageMicroLocationService.locationOrderByDrag(req.body);
        res.status(200).json({
            message: 'Update Priority Microlocation'
        })
    } catch (error) {
        next(error)
    }
   }
    async getPriorityMicrolocations(req, res, next) {
        try {
            const result = await manageMicroLocationService.getPriorityMicrolocations(req.query);
            res.status(200).json({
                message: 'Priority Microlocations List',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async addPriorityMicrolocations(req, res, next) {
        try {
            await manageMicroLocationService.addPriorityMicrolocations(req.body);
            res.status(200).json({
                message: 'Priority Microlocations Added'
            })
        } catch (error) {
            next(error)
        }
    }
}

export default new ManageMicroLocation();