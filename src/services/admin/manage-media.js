import { ObjectId } from 'mongodb';
import models from '../../models/index.js';
const Media = models['Media'];

class ManageCityService {
    constructor() {
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };
        return {
            getCities: this.getCities.bind(this),
            getCityById: this.getCityById.bind(this),
            getCityByName: this.getCityByName.bind(this),
            addCity: this.addCity.bind(this),
            updateCity: this.updateCity.bind(this),
            toggleCityStatus: this.toggleCityStatus.bind(this),
            deleteCity: this.deleteCity.bind(this),
        }
    }

    async getCities({ limit, skip, orderBy = 1, sortBy = 'name', name, dropdown }) {
        try {
            let result = {};
            let condition = {};
            if (name) {
                name = '.*' + name + '.*';
                condition['name'] = { $regex: new RegExp('^' + name + '$', 'i') };
            }
            if (dropdown) {
                result.cities = await Media.find(condition)
                    .sort({
                        // [sortBy]: orderBy,
                        createdAt: -1
                    });
            } else {
                result.cities = await Media.find(condition)
                    .populate('image')
                    .limit(limit)
                    .skip(skip)
                    .sort({
                        // [sortBy]: orderBy,
                        createdAt: -1
                    });
            }
            result.count = await Media.countDocuments(condition);
            return result;
        } catch (e) {
            throw (e)
        }
    }

    async getCityById({ id }) {
        try {
            const city = await Media.findOne({ _id: id });
            return city;
        } catch (error) {
            throw (error);
        }
    }

    async getCityByName({ cityName }) {
        try {
            let findName = '.*' + cityName + '.*';
            findName = { $regex: new RegExp('^' + cityName + '$', 'i') };
            const city = await Media.findOne({ name: findName });
            return city;
        } catch (error) {
            throw (error);
        }
    }

    async addCity({ name, image, description }) {
        try {
            const city = await Media.create({ name, image, description });
            return city;
        } catch (e) {
            throw (e)
        }
    }

    async updateCity({ cityId, name, image, description }) {
        try {
            return await Media.findOneAndUpdate({ _id: cityId }, { name, image, description }, { new: true });
        } catch (e) {
            throw (e)
        }
    }

    async toggleCityStatus({ cityId }) {
        try {
            const cityStatus = await Media.findOne({ _id: cityId });
            const city = await Media.findByIdAndUpdate({ _id: cityId }, { active: !cityStatus.active }, this.updateOptions);
            return city;
        } catch (e) {
            throw (e)
        }
    }

    async deleteCity({ cityId }) {
        try {
            await Media.deleteOne({ _id: cityId });
            return true;
        } catch (error) {
            throw (error)
        }
    }

}

export default new ManageCityService();