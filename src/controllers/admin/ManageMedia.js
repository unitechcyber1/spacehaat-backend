import manageCityServices from '../../services/admin/manage-media.js';
import FileUtility from "../../utilities/file.js"
class ManageCity {
    constructor() {
        return {
            getCities: this.getCities.bind(this),
            getCityById: this.getCityById.bind(this),
            getCityByName: this.getCityByName.bind(this),
            addOrEditCity: this.addOrEditCity.bind(this),
            toggleCityStatus: this.toggleCityStatus.bind(this),
            deleteCity: this.deleteCity.bind(this),
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
    async getCityByName(req, res, next) {
        try {
            const object = Object.assign({}, req.params, req.query);
            const result = await manageCityServices.getCityByName(object);
            res.status(200).json({
                message: 'get city by name',
                data: result
            })
        } catch (error) {
            next(error);
        }
    }
    async addOrEditCity(req, res, next) {
        try {
            let city = null;
            let message = 'City Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body);
                city = await manageCityServices.updateCity(forEdit);
                message = 'City Updated';
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
    async deleteCity(req, res, next) {
        let fileDetails; // Declare the variable here
    
        try {
            const { s3_link, name } = req.body;
            await manageCityServices.deleteCity(req.params);
    
            if (s3_link) {
                let imageFolderName = s3_link.split('/');
                imageFolderName = imageFolderName[imageFolderName.length - 2];
                fileDetails = await FileUtility.deleteFile(name, imageFolderName);
            }
    
            res.status(200).json({
                message: 'city deleted',
                fileDetails: fileDetails // Include fileDetails in the response if needed
            });
        } catch (error) {
            next(error);
        }
    }
    
}

export default new ManageCity();