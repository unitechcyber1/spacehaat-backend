import { ObjectId } from 'mongodb';
import models from "../../models/index.js";
const City = models['City'];
const Country = models['Country'];
const MicroLocation = models['MicroLocation'];
const FeaturedSpace = models['FeaturedSpace'];
const AdsImage = models['AdsImage'];
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
            getCityByState: this.getCityByState.bind(this),
            getCityByCountry: this.getCityByCountry.bind(this),
            deleteCity: this.deleteCity.bind(this),
            getByCityName: this.getByCityName.bind(this),
            getByCityName1: this.getByCityName1.bind(this),
            getfeaturedImages: this.getfeaturedImages.bind(this),
            getBrandAdsImages: this.getBrandAdsImages.bind(this),
            getCitiesBySpaceType: this.getCitiesBySpaceType.bind(this),
            citiesBySpaceType: this.citiesBySpaceType.bind(this),
            getActiveCityForAllSpaceTypes: this.getActiveCityForAllSpaceTypes.bind(this),

        }
    }

    async getCities({ limit, skip, orderBy = 1, sortBy = 'name', name, country, dropdown, for_coWorking, for_office, for_coLiving, for_flatspace, for_virtual }) {
        try {
            let result = {};
            let condition = {};
            if (name) {
                name = '.*' + name + '.*';
                condition['name'] = { $regex: new RegExp('^' + name + '$', 'i') };
            }
            if (country) {
                condition['country'] = country;
            }
            if (for_coWorking) {
                condition['for_coWorking'] = true;
            }
            if (for_office) {
                condition['for_office'] = true;
            }
            if (for_coLiving) {
                condition['for_coLiving'] = true;
            }
            if (for_flatspace) {
                condition['for_flatspace'] = true;
            }
            if (for_virtual) {
                condition['for_virtual'] = true;
            }
            if (dropdown) {
                result.cities = await City.find(condition)
                    .sort({
                        [sortBy]: orderBy
                    });
            } else {
                result.cities = await City.find(condition)
                    .populate('country')
                    .populate('state')
                    .populate('image')
                    .populate('icons')
                    .populate('cityImage.coworking')
                    .populate('cityImage.coliving')
                    .populate('cityImage.officespace')
                    .populate('cityImage.buildings')
                    .populate('cityImage.virtualoffice')
                    .limit(limit)
                    .skip(skip)
                    .sort({
                        [sortBy]: orderBy
                    });
            }
            result.count = await City.countDocuments(condition);
            return result;
        } catch (e) {
            throw (e)
        }
    }

    async getCityById({ id }) {
        try {
            const city = await City.findOne({ _id: id });
            return city;
        } catch (error) {
            throw (error);
        }
    }

    async getCityByName({ cityName }) {
        try {
            let findName = '.*' + cityName + '.*';
            findName = { $regex: new RegExp('^' + cityName + '$', 'i') };
            const city = await City.findOne({ name: findName });
            return city;
        } catch (error) {
            throw (error);
        }
    }

    async addCity({ name, for_flatspace, cityImage, for_coWorking, for_office, for_coLiving, for_virtual, description, country, state, image, icons }) {
        try {
            const city = await City.create({ name, for_flatspace, cityImage, for_coWorking, for_office, for_coLiving, for_virtual, description, country, state, image, icons });
            return city;
        } catch (e) {
            throw (e)
        }
    }

    async updateCity({ cityId, name, cityImage, for_flatspace, for_coWorking, for_office, for_coLiving, for_virtual, description, country, state, image, icons }) {
        try {
            return await City.findOneAndUpdate({ _id: cityId }, { name, cityImage, for_flatspace, for_coWorking, for_office, for_coLiving, for_virtual, description, country, state, image, icons }, { new: true });

        } catch (e) {
            throw (e)
        }
    }

    async toggleCityStatus({ cityId }) {
        try {
            const cityStatus = await City.findOne({ _id: cityId });
            const city = await City.findByIdAndUpdate({ _id: cityId }, { active: !cityStatus.active }, this.updateOptions);
            return city;
        } catch (e) {
            throw (e)
        }
    }

    async getCityByState({ stateId }) {
        try {
            const city = await City.find({ state: stateId });
            return city;
        } catch (error) {
            throw (error);
        }
    }

    async getCityByCountry({ countryId }) {
        try {
            let city_id = []
            const Countrys = await Country.find({ _id: countryId }, { name: 1 });
            const city = await City.find({ country: countryId })
                .populate('image')
                .populate('icons')
                .populate('cityImage.coworking')
                .populate('cityImage.coliving')
                .populate('cityImage.officespace')
                .populate('cityImage.buildings')
                .populate('cityImage.virtualoffice')
            for (let index = 0; index < city.length; index++) {
                var micro_loc = []
                const microLocation = await MicroLocation.find({ city: city[index]._id }, { name: 1, _id: 0 });
                for (let i = 0; i < microLocation.length; i++) {
                    micro_loc.push(microLocation[i].name)
                }
                city_id.push({
                    "id": city[index]._id,
                    'icon': city[index].icons,
                    'image': city[index].image,
                    "name": city[index].name,
                    "for_coWorking": city[index].for_coWorking,
                    "for_office": city[index].for_office,
                    "for_coLiving": city[index].for_coLiving,
                    "for_flatspace": city[index].for_flatspace,
                    "for_virtual": city[index].for_virtual,
                    "locations": micro_loc,
                    "Country": Countrys[0],
                })
            }
            city_id = city_id.sort(function(a, b) {
                if (a.name.trim() < b.name.trim()) {
                    return -1;
                }
                if (a.name.trim() > b.name.trim()) {
                    return 1;
                }
                return 0;
            });
            return city;
        } catch (error) {
            throw (error);
        }
    }

    async getCitiesBySpaceType(query) {
        try {
            let city_id = [];
            let condition = {};
            condition['country'] = query.countryId;
            if (query.for_coWorking) {
                condition['for_coWorking'] = true
            }
            if (query.for_coLiving) {
                condition['for_coLiving'] = true
            }
            if (query.for_office) {
                condition['for_office'] = true
            }
            if (query.for_flatspace) {
                condition['for_flatspace'] = true
            }
            if(query.for_virtual) {
                condition['for_virtual'] = true
            }
            const Countrys = await Country.find({ _id: query.countryId }, { name: 1 });
            const city = await City.find(condition)
                .populate('image')
                .populate('icons')
                .populate('cityImage.coworking')
                .populate('cityImage.coliving')
                .populate('cityImage.officespace')
                .populate('cityImage.buildings')
                .populate('cityImage.virtualoffice')
            for (let index = 0; index < city.length; index++) {
                var micro_loc = []
                const microLocation = await MicroLocation.find({ city: city[index]._id }, { name: 1, _id: 0 });
                for (let i = 0; i < microLocation.length; i++) {
                    micro_loc.push(microLocation[i].name)
                }
                city_id.push({
                    "id": city[index]._id,
                    'icon': city[index].icons,
                    'image': city[index].image,
                    "name": city[index].name,
                    "for_coWorking": city[index].for_coWorking,
                    "for_office": city[index].for_office,
                    "for_coLiving": city[index].for_coLiving,
                    "for_flatspace": city[index].for_flatspace,
                    "for_virtual": city[index].for_virtual,
                    "locations": micro_loc,
                    "Country": Countrys[0],
                    "cityImage": city[index].cityImage
                })
            }
            return city_id;
        } catch (error) {
            throw (error);
        }
    }

    async getActiveCityForAllSpaceTypes() {
        try {
            let result = {};
            result.cities = await City.find({
                country: "6231ae062a52af3ddaa73a39",
                $or: [
                  { for_coWorking: true },
                  { for_office: true },
                  { for_coLiving: true },
                  { for_flatspace: true },
                  { for_virtual: true }
                ]
              },
              { name: 1 }).sort({ name: 1 })
            return result;
        } catch (error) {
            throw (error);
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
            const city = await City.findOne({ 'name': cityId })
                // .populate('images.image')
                // .populate('seo.twitter.image');
            var micro_loc = []
            const microLocation = await MicroLocation.find({ city: city._id}, { name: 1, _id: 0 });
            for (let i = 0; i < microLocation.length; i++) {
                micro_loc.push(microLocation[i].name)
            }
            let citys = {
                "id": city._id,
                'icon': city.icons ? city.icons.name : "",
                'image': city.image ? city.image.name : "",
                "name": city.name,
                "for_coWorking": city.for_coWorking,
                "for_office": city.for_office,
                "for_coLiving": city.for_office,
                "for_flatspace": city.for_flatspace,
                "for_virtual": city.for_virtual,
                "locations": micro_loc
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
            const country = await City.findOne({ name: findName })
                .populate('country').select("_id name country")
            return country;
        } catch (error) {
            throw (error);
        }
    }

    async deleteCity({ cityId }) {
        try {
            await City.deleteOne({ _id: cityId });
            return true;
        } catch (error) {
            throw (error)
        }
    }

    async getfeaturedImages({ limit, skip, orderBy = 1, sortBy = 'name', name, dropdown }) {
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

    async getBrandAdsImages({ limit, skip, orderBy = 1, sortBy = 'name', name, dropdown }) {
        try {
            let result = {};
            let condition = {};
            if (name) {
                name = '.*' + name + '.*';
                condition['name'] = { $regex: new RegExp('^' + name + '$', 'i') };
            }
            if (dropdown) {
                result.cities = await AdsImage.find(condition)
                    .sort({
                        [sortBy]: orderBy
                    });
            } else {
                result.cities = await AdsImage.find(condition)
                    .populate('image')
                    .limit(limit)
                    .skip(skip)
                    .sort({
                        [sortBy]: orderBy
                    });
            }
            result.count = await AdsImage.countDocuments(condition);
            return result;
        } catch (e) {
            throw (e)
        }
    }

    async citiesBySpaceType(query) {
        try {
            let result = {};
            let condition = {};
            condition['country'] = query.country_id;
            if (query.for_coworking) {
                condition['for_coWorking'] = true
            }
            if (query.for_coliving) {
                condition['for_coLiving'] = true
            }
            if (query.for_office) {
                condition['for_office'] = true
            }
            if (query.for_flat) {
                condition['for_flatspace'] = true
            }
            if (query.for_virtual) {
                condition['for_virtual'] = true
            }
            result.cities = await City.find(condition);
            result.count = await City.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }
}

export default new ManageCityService();