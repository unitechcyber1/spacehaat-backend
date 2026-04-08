import manageCountryServices from '../../services/admin/manage-country.js';

class ManageCountry {
    constructor() {
        return {
            getCountries: this.getCountries.bind(this),
            getCountryById: this.getCountryById.bind(this),
            addOrEditCountry: this.addOrEditCountry.bind(this),
            toggleCountryStatus: this.toggleCountryStatus.bind(this),
            getSpacesByCity: this.getSpacesByCity.bind(this),
            getCountriesBydynamic: this.getCountriesBydynamic.bind(this),
            getCountryByName:this.getCountryByName.bind(this),
            deleteCountry: this.deleteCountry.bind(this)
        }
    }

    async getCountries(req, res, next) {
        try {
            const result = await manageCountryServices.getCountries(req.query);
            return res.status(200).json({
                message: "Country List",
                data: result.countries,
                totalRecords: result.count
            })
        } catch (e) {
            next(e)
        }
    }

    async getCountriesBydynamic(req, res, next) {
        try {
            const result = await manageCountryServices.getCountriesBydynamic(req.body);
            return res.status(200).json({
                message: "Country List",
                data: result.countries,
                totalRecords: result.count
            })
        } catch (e) {
            next(e)
        }
    }


    async getCountryById(req, res, next) {
        try {
            const country = await manageCountryServices.getCountryById(req.params);
            res.status(200).json({
                message: 'get country by id',
                data: country
            })
        } catch (error) {
            next(error);
        }
    }
    
    async getCountryByName(req, res, next) {
        try {
            const country = await manageCountryServices.getCountryByName(req.params);
            res.status(200).json({
                message: 'get country by name',
                data: country
            })
        } catch (error) {
            next(error);
        }
    }

    async addOrEditCountry(req, res, next) {
        try {
            let city = null;
            let message = 'Country Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body);
                city = await manageCountryServices.updateCountry(forEdit);
                message = 'Country Updated';
            } else {
                city = await manageCountryServices.addCountry(req.body);
            }
            res.status(200).json({
                message,
                data: city
            });
        } catch (error) {
            next(error)
        }
    }

    async toggleCountryStatus(req, res, next) {
        try {
            await manageCountryServices.toggleCountryStatus(req.params);
            return res.status(200).json({
                message: "Country Status Changed"
            })
        } catch (e) {
            next(e)
        }
    }

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
    async deleteCountry(req, res, next) {
        try {
            await manageCountryServices.deleteCountry(req.params);
            res.status(200).json({
                message: 'country deleted'
            })
        } catch (error) {
            next(error);
        }
    }
}

export default new ManageCountry();