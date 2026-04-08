import models from '../../models/index.js';
const Country = models['Country'];
const WorkSpace = models['WorkSpace']

class ManageCountryService {
    constructor() {
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };
        return {
            getCountries: this.getCountries.bind(this),
            getCountriesBydynamic: this.getCountriesBydynamic.bind(this),
            getCountryById: this.getCountryById.bind(this),
            getCountryByName: this.getCountryByName.bind(this),
            addCountry: this.addCountry.bind(this),
            updateCountry: this.updateCountry.bind(this),
            toggleCountryStatus: this.toggleCountryStatus.bind(this),
            getSpacesByCity: this.getSpacesByCity.bind(this),
            deleteCountry: this.deleteCountry.bind(this)
        }
    }

    async getCountries({ limit, skip, orderBy = 1, sortBy = 'name', name, dropdown }) {
        try {
            let result = {};
            let condition = {};
            if (name) {
                name = '.*' + name + '.*';
                condition['name'] = { $regex: new RegExp('^' + name + '$', 'i') };
            }
            if (dropdown) {
                result.countries = await Country.find(condition)
                    .sort({
                        [sortBy]: orderBy
                    });
            } else {
                result.countries = await Country.find(condition)
                    .populate('image')
                    .limit(limit)
                    .skip(skip)
                    .sort({
                        [sortBy]: orderBy
                    });
            }
            result.count = await Country.countDocuments(condition);
            return result;
        } catch (e) {
            throw (e)
        }
    }

    async getCountriesBydynamic({ for_coWorking, for_office, for_coLiving, for_flatspace, for_queryform }) {
        try {
            let result = {};
            let condition = {};
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
            if (for_queryform) {
                condition['for_queryform'] = true;
            }
            const country = await Country.find(condition).populate('image').select('_id name dial_code image for_coWorking for_office for_coLiving for_flatspace');
            result.countries = country;
            result.count = country.length;
            return result;
        } catch (error) {
            throw (error);
        }
    }

    // async getCountryById({ id }) {
    //     try {
    //         const country = await Country.findOne({ _id: id })
    //             .populate('image')
    //         return country;
    //     } catch (error) {
    //         throw (error);
    //     }
    // }
    async getCountryById({ id }) {
        try {
            const country = await Country.findOne({ _id: id })
                .populate('image')
            return country;
        } catch (error) {
            throw (error);
        }
    }

    async getCountryByName({ countryName }) {
        try {
            let findName = '.*' + countryName + '.*';
            findName = { $regex: new RegExp('^' + countryName + '$', 'i') };
            const country = await Country.findOne({ name: findName });
            return country;
        } catch (error) {
            throw (error);
        }
    }

    async addCountry({ name, for_flatspace, for_coWorking, for_office, for_coLiving, description, image, dial_code, iso_code }) {
        try {
            const country = await Country.create({ name, for_flatspace, for_coWorking, for_office, for_coLiving, description, image, dial_code, iso_code });
            return country;
        } catch (e) {
            throw (e)
        }
    }

    async updateCountry({ countryId, name, for_flatspace, for_coWorking, for_office, for_coLiving, description, image, dial_code, iso_code }) {
        try {
            return await Country.findOneAndUpdate({ _id: countryId }, { name, for_flatspace, for_coWorking, for_office, for_coLiving, description, image, dial_code, iso_code }, { new: true });
        } catch (e) {
            throw (e)
        }
    }

    async toggleCountryStatus({ countryId }) {
        try {
            const countryStatus = await Country.findOne({ _id: countryId });
            const country = await Country.findByIdAndUpdate({ _id: countryId }, { active: !countryStatus.active }, this.updateOptions);
            return country;
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

    async deleteCountry({ cityId }) {
        try {
            await Country.deleteOne({ _id: cityId });
            return true;
        } catch (error) {
            throw (error)
        }
    }
}

export default new ManageCountryService();