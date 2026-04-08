import manageCityServices from '../../services/admin/manage-featuredSpace.js';

class ManageCity {
    constructor() {
        return {
            getCities: this.getCities.bind(this),
            getCityById: this.getCityById.bind(this),
            addOrEditCity: this.addOrEditCity.bind(this),
            toggleCityStatus: this.toggleCityStatus.bind(this),
            getSpacesByCity: this.getSpacesByCity.bind(this),
            // getCityByCountryState: this.getCityByCountryState.bind(this),
            // getCityByCountryOnly: this.getCityByCountryOnly.bind(this),
            deleteCity: this.deleteCity.bind(this),
            getByCityName:this.getByCityName.bind(this),
            getByCityName1:this.getByCityName1.bind(this)
        }
    }

    async getCities(req, res, next) {
        try {
            const result = await manageCityServices.getCities(req.query);
            return res.status(200).json({
                message: "City List",
                data: result.cities,
                totalRecords: result.count
            })
        } catch (e) {
            next(e)
        }
    }

    async getCityById(req, res, next) {
        try {
            const city = await manageCityServices.getCityById(req.params);
            res.status(200).json({
                message: 'get city by id',
                data: city
            })
        } catch (error) {
            next(error);
        }
    }

    async addOrEditCity(req, res, next) {
        try {
            let city = null;
            let message = 'Featured image Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body);
                city = await manageCityServices.updateCity(forEdit);
                message = 'Featured image Updated';
            } else {
                city = await manageCityServices.addCity(req.body);
            }
            res.status(200).json({
                message,
                data: city
            });
        } catch (error) {
            next(error)
        }
    }

    async toggleCityStatus(req, res, next) {
        try {
            await manageCityServices.toggleCityStatus(req.params);
            return res.status(200).json({
                message: "City Status Changed"
            })
        } catch (e) {
            next(e)
        }
    }

    // async getCityByCountryState(req, res, next) {
    //     try {
    //         const cities = await manageCityServices.getCityByState(req.params);
    //         return res.status(200).json({
    //             message: "cities by state",
    //             data: cities
    //         })
    //     } catch (error) {
    //         next(error)
    //     }
    // }
    // async getCityByCountryOnly(req, res, next) {
    //     try {
    //         const cities = await manageCityServices.getCityByCountry(req.params);
    //         return res.status(200).json({
    //             message: "cities by state",
    //             data: cities
    //         })
    //     } catch (error) {
    //         next(error)
    //     }
    // }

    async getSpacesByCity(req, res, next) {
        try {
            const object = Object.assign({}, req.params, req.query);
            const result = await manageCityServices.getSpacesByCity(object);
            res.status(200).json({
                message: 'get city by id',
                data: result
            })
        } catch (error) {
            next(error);
        }
    }
    async getByCityName(req, res, next) {
        try {
            const object = Object.assign({}, req.params, req.query);
            const result = await manageCityServices.getByCityName(object);
            res.status(200).json({
                message: 'get city by name',
                data: result
            })
        } catch (error) {
            next(error);
        }
    }
    async getByCityName1(req, res, next) {
        try {
            const object = Object.assign({}, req.params, req.query);
            const result = await manageCityServices.getByCityName1(object);
            res.status(200).json({
                message: 'get city by name',
                data: result
            })
        } catch (error) {
            next(error);
        }
    }
    async deleteCity(req, res, next) {
        try {
            await manageCityServices.deleteCity(req.params);
            res.status(200).json({
                message: 'city deleted'
            })
        } catch (error) {
            next(error);
        }
    }
}

export default new ManageCity();