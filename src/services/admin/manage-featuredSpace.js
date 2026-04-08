import { ObjectId } from 'mongodb';
import models from '../../models/index.js';
const FeaturedSpace = models['FeaturedSpace'];
const Country = models['Country'];
const MicroLocation = models['MicroLocation'];
const WorkSpace = models['WorkSpace'];


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
            getSpacesByCity: this.getSpacesByCity.bind(this),
            deleteCity: this.deleteCity.bind(this),
            getByCityName: this.getByCityName.bind(this),
            getByCityName1: this.getByCityName1.bind(this),

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
                result.cities = await FeaturedSpace.find(condition)
                    .sort({
                        [sortBy]: orderBy
                    });
            } else {
                result.cities = await FeaturedSpace.find(condition)
                    .populate('image')
                    .limit(limit)
                    .skip(skip)
                    .sort({
                        [sortBy]: orderBy
                    });
            }
            result.count = await FeaturedSpace.countDocuments(condition);
            return result;
        } catch (e) {
            throw (e)
        }
    }

    async getCityById({ id }) {
        try {
            const city = await FeaturedSpace.findOne({ _id: id });
            return city;
        } catch (error) {
            throw (error);
        }
    }

    async getCityByName({ cityName }) {
        try {
            let findName = '.*' + cityName + '.*';
            findName = { $regex: new RegExp('^' + cityName + '$', 'i') };
            const city = await FeaturedSpace.findOne({ name: findName });
            return city;
        } catch (error) {
            throw (error);
        }
    }

    async addCity({ name, for_flatspace, for_coWorking, for_office, for_coLiving, description, image }) {
        try {
            const city = await FeaturedSpace.create({ name, for_flatspace, for_coWorking, for_office, for_coLiving, description, image });
            return city;
        } catch (e) {
            throw (e)
        }
    }

    async updateCity({ cityId, name, for_flatspace, for_coWorking, for_office, for_coLiving, description, image }) {
        try {
            return await FeaturedSpace.findOneAndUpdate({ _id: cityId }, { name, for_flatspace, for_coWorking, for_office, for_coLiving, description, image }, { new: true });
        } catch (e) {
            throw (e)
        }
    }

    async toggleCityStatus({ cityId }) {
        try {
            const cityStatus = await FeaturedSpace.findOne({ _id: cityId });
            const city = await FeaturedSpace.findByIdAndUpdate({ _id: cityId }, { active: !cityStatus.active }, this.updateOptions);
            return city;
        } catch (e) {
            throw (e)
        }
    }

    async getSpacesByCity({ cityId, limit, skip, orderBy = 1, sortBy = 'name', name }) {
        try {
            let result = {};
            result.workSpaces = await WorkSpace.find({ 'location.city': cityId })
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .populate('brand')
                .populate('location.city')
                .limit(limit)
                .skip(skip)
                .sort({
                    [sortBy]: orderBy
                });
            result.count = await WorkSpace.countDocuments({ 'location.city': cityId });
            return result;
        } catch (error) {
            throw (error);
        }
    }
    async getByCityName({ cityId }) {
        try {
            let result = {};
            const city = await FeaturedSpace.findOne({ 'name': cityId })
                .populate('images.image')
            var micro_loc = []
            let citys = {
                "id": city._id,
                'image': city.image ? city.image.name : "",
                "name": city.name,
                "for_coWorking": city.for_coWorking,
                "for_office": city.for_office,
                "for_coLiving": city.for_office,
                "for_flatspace": city.for_flatspace,
            }
            result.city = citys;
            result.count = 0;
            return result;
        } catch (error) {
            throw (error);
        }
    }
    async getByCityName1({ cityId }) {
        try {
            let findName = '.*' + cityId + '.*';
            findName = { $regex: new RegExp('^' + cityId + '$', 'i') };
            const country = await FeaturedSpace.findOne({ name: findName })
                .populate('country')
            return country;
        } catch (error) {
            throw (error);
        }
    }
    async deleteCity({ cityId }) {
        try {
            await FeaturedSpace.deleteOne({ _id: cityId });
            return true;
        } catch (error) {
            throw (error)
        }
    }
}

export default new ManageCityService();