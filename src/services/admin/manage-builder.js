import models from '../../models/index.js';
import manageWorkSpaceService from './manage-work-space.js';
import crypto from 'crypto';
import _ from 'lodash';
import FileUtility from '../../utilities/file.js';
import { findCountryByCoordinate } from "country-locator";
import {getCountry} from 'country-currency-map';
import FileUpload from '../../controllers/common/fileUpload.js'
const Builder = models['Builder'];
const Country = models['Country'];
const MicroLocation = models['MicroLocation'];
const BuilderPriority = models['BuilderPriority'];
const Image = models['Image'];

class ManageBuilderService {
    constructor() {
        this.axiosConfig = {
            headers: {
                'Content-Type': 'application/json'
            }
        }
        this.updateOptions = {  
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };
        return {
            getBuilders: this.getBuilders.bind(this),
            getBuildersById: this.getBuildersById.bind(this),
            createBuilder: this.createBuilder.bind(this),
            updateBuilder: this.updateBuilder.bind(this),
            addPriorityBuilder: this.addPriorityBuilder.bind(this),
            setPriorityByType: this.setPriorityByType.bind(this),
            changeBuilderStatus: this.changeBuilderStatus.bind(this),
            deleteBuilder: this.deleteBuilder.bind(this),
            changeSlugById: this.changeSlugById.bind(this),
            getPriorityBuilders: this.getPriorityBuilders.bind(this)
        }
    }

    async getBuilders({ limit = 10, sortBy = 'name', orderBy = 1, skip, name, city, location, micro_location, shouldApprove = false, userid, status }) {
        try {
            let result = {};
            let condition = {};
            if (name) {
                /** TODO $text search will be implemented */
                name = name.replace(/[^A-Za-z0-9 ]/g, "");
                condition['name'] = { '$regex': `^(\s+${name}|^${name})`, '$options': 'i' };
            }
            if (city) {
                condition['location.city'] = city;
            }
            if (micro_location) {
                condition['location.micro_location'] = micro_location;
            }
            if (location) {
                let microid = [];
                let mcondition = {};
                location = '.*' + location + '.*';
                mcondition['name'] = { $regex: new RegExp('^' + location + '$', 'i') };
                let microlocation = await MicroLocation.find(mcondition, { _id: 1 });
                for (const key in microlocation) {
                    microid.push(microlocation[key]['id']);
                }
                condition['location.micro_location'] = { "$in": microid };
            }
            if (shouldApprove) {
                condition['status'] = 'approve';
                condition['is_active'] = true;
            }
            if (userid) {
                condition['user'] = userid;
            }
            if (status) {
                condition['status'] = status;
            }
            if (status == 'all') {
                delete condition['status']
            }

            result.builders = await Builder.find(condition)
                .populate('location.micro_location')
                .populate('location.city')
                .populate('location.country')
                .populate('images.image')
                .populate('user')
                .limit(limit)
                .skip(skip)
                .sort({
                    createdAt: -1
                });
            result.count = await Builder.countDocuments(condition);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async getBuildersById({ builderId }) {
        try {
            const builders = await Builder.findOne({ _id: builderId })
                .populate('images.image')
                .populate('builder_logo')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .populate('user')
            return builders;
        } catch (error) {
            throw error;
        }
    }

    async createBuilder({
        name,
        description,
        projects,
        isCommercial,
        isResidential,
        ratings,
        spaceTag,
        establish_year,
        builder_logo,
        overview,
        video_link,
        email,
        contact_details,
        website_Url,
        images,
        social_media,
        location,
        seo,
        user,
        added_by_user,
        slug
    }) {
        try {
            var expiryDate = new Date();
            var geometry;
            var currency_code;
            var country_dbname;
            expiryDate.setMonth(expiryDate.getMonth() + 3);
            let expireAt = expiryDate;
            if (location && location.latitude && location.longitude) {
                const countryInfo = findCountryByCoordinate(+location.latitude, +location.longitude);
                let country_name = countryInfo.name;
                let currency_code = getCountry(country_name).currency;
                geometry = this._setGeoLocation(location);
            }
            if (name & location.name) {
                // slug = await this._createSlug(null, name, location.name);
                const country_details = await Country.findOne({ _id: location.country });
                currency_code = getCountry(country_details.name).currency;
                country_dbname = country_details.name;
            }
            return await Builder.create({
                name,
                description,
                projects,
                isCommercial,
                isResidential,
                ratings,
                spaceTag,
                establish_year,
                builder_logo,
                overview,
                video_link,
                email,
                contact_details,
                website_Url,
                images,
                social_media,
                location,
                geometry,
                seo,
                user,
                added_by_user,
                currency_code,
                country_dbname,
                slug,
                expireAt
            })
        } catch (error) {
            throw error;
        }
    }

    async updateBuilder({
        id,
        name,
        description,
        isCommercial,
        isResidential,
        ratings,
        spaceTag,
        projects,
        establish_year,
        builder_logo,
        overview,
        video_link,
        email,
        contact_details,
        website_Url,
        images,
        social_media,
        location,
        seo,
        user,
        added_by_user,
        slug
    }) {
        try {
            const geometry = this._setGeoLocation(location);
            // const slug = await this._createSlug(id, name, location.name);
            const countryInfo = findCountryByCoordinate(location.latitude, location.longitude);
            let country_name = countryInfo.name;
            let currency_code = getCountry(country_name).currency;
            const country_details = await Country.findOne({ _id: location.country });
            let country_dbname = country_details.name;
            return await Builder.findOneAndUpdate({ _id: id }, {
                name,
                description,
                projects,
                isCommercial,
                isResidential,
                ratings,
                spaceTag,
                establish_year,
                builder_logo,
                overview,
                video_link,
                email,
                contact_details,
                website_Url,
                images,
                social_media,
                location,
                seo,
                user,
                added_by_user,
                slug,
                currency_code,
                country_dbname,
            })
        } catch (error) {
            throw error;
        }
    }

    async changeBuilderStatus({ builderId, status }) {
        try {
            let updateData = {};
            if (status === 'reject') {
                updateData = {
                    "status": status,
                    "priority.overall.is_active": false,
                    "priority.overall.order": 1000,
                    "priority.location.is_active": false,
                    "priority.location.order": 1000,
                    "priority.micro_location.is_active": false,
                    "priority.micro_location.order": 1000
                }
            } else {
                updateData = {
                    "status": status,
                }
            }
            return await Builder.findOneAndUpdate({ _id: builderId }, { $set: updateData });
        } catch (error) {
            throw error;
        }
    }

    async addPriorityBuilder({ id, type, data }) {
        try {
            if (type === 'overall') {
                let object = manageWorkSpaceService._createDynamicPriorityType(type);
                if (!data.is_active) {
                    const { priority } = await Builder.findOne({ _id: id }, { priority: 1 });
                    const priorityOrder = object + '.order';
                    const priorityActive = object + '.is_active';
                    const condition = {
                        [priorityOrder]: { $gt: priority[type].order },
                        [priorityActive]: true
                    };
                    if (data.city) {
                        condition['location.city'] = data.city;
                    }
                    await Builder.updateMany(condition, {
                        $inc: {
                            [priorityOrder]: -1
                        }
                    });
                }
                await Builder.updateOne({ '_id': id }, {
                    $set: {
                        [object]: data
                    }
                });
                return true;
            } else {
                const options = { upsert: true }; // Set upsert option to true
                let object = manageWorkSpaceService._createDynamicPriorityType(type);
                if (!data.is_active) {
                    const { priority } = await BuilderPriority.findOne({ 'builder': id, city: data['city'] }, { priority: 1 });
                    const priorityOrder = object + '.order';
                    const priorityActive = object + '.is_active';
                    const condition = {
                        [priorityOrder]: { $gt: priority[type].order },
                        [priorityActive]: true
                    };
                    if (data.city) {
                        condition['city'] = data.city;
                    }
                    await BuilderPriority.updateMany(condition, {
                        $inc: {
                            [priorityOrder]: -1
                        }
                    });
                }
                await BuilderPriority.findOneAndUpdate({ 'builder': id, city: data['city'] }, {
                    $set: {
                        [object]: data,
                        builder: id,
                        city: data['city']
                    }
                }, options);
                return true;
            }
        } catch (error) {
            throw (error);
        }
    }

    async setPriorityByType({ initialPosition, finalPosition, shiftedId, type, city }) {
        try {
            if (type === 'overall') {
                const priorityOrder = manageWorkSpaceService._createDynamicPriorityType(type) + '.order';
                const priorityActive = manageWorkSpaceService._createDynamicPriorityType(type) + '.is_active';
                if (initialPosition < finalPosition) {
                    await Builder.updateMany({
                        [priorityOrder]: { $lte: finalPosition, $gt: initialPosition },
                        [priorityActive]: true
                    }, {
                        $inc: {
                            [priorityOrder]: -1
                        }
                    })
                    await Builder.updateOne({ _id: shiftedId }, {
                        $set: {
                            [priorityOrder]: finalPosition
                        }
                    })
                }
                if (initialPosition > finalPosition) {
                    await Builder.updateMany({
                        [priorityOrder]: { $lt: initialPosition, $gte: finalPosition },
                        [priorityActive]: true
                    }, {
                        $inc: {
                            [priorityOrder]: 1
                        }
                    })
                    await Builder.updateOne({ _id: shiftedId }, {
                        $set: {
                            [priorityOrder]: finalPosition
                        }
                    })
                }
            } else {
                const priorityOrder = manageWorkSpaceService._createDynamicPriorityType(type) + '.order';
                const priorityActive = manageWorkSpaceService._createDynamicPriorityType(type) + '.is_active';
                if (initialPosition < finalPosition) {
                    await BuilderPriority.updateMany({
                        [priorityOrder]: { $lte: finalPosition, $gt: initialPosition },
                        [priorityActive]: true,
                        city: city,
                    }, {
                        $inc: {
                            [priorityOrder]: -1
                        }
                    })
                    await BuilderPriority.updateOne({ builder: shiftedId, city: city }, {
                        $set: {
                            [priorityOrder]: finalPosition
                        }
                    })
                }
                if (initialPosition > finalPosition) {
                    await BuilderPriority.updateMany({
                        [priorityOrder]: { $lt: initialPosition, $gte: finalPosition },
                        [priorityActive]: true,
                        city: city,
                    }, {
                        $inc: {
                            [priorityOrder]: 1
                        }
                    })
                    await BuilderPriority.updateOne({ builder: shiftedId, city: city }, {
                        $set: {
                            [priorityOrder]: finalPosition
                        }
                    })
                }
            }
        } catch (e) {
            throw (e)
        }
    }

    async getPriorityBuilders({ type, city }) {
        try {
            if (type === 'overall') {
                let result = {};
                const priorityType = manageWorkSpaceService._createDynamicPriorityType(type) + '.is_active';
                const priorityTypeOrder = manageWorkSpaceService._createDynamicPriorityType(type) + '.order';
                let condition = {
                    [priorityType]: true
                };
                result.prioritySpaces = await Builder.find(condition)
                    .populate('location.city')
                    .populate('images.image')
                    .populate('seo.twitter.image')
                    .populate('seo.open_graph.image')
                    .sort({
                        [priorityTypeOrder]: 1
                    });
                if (type === 'location') {
                    result.prioritySpaces = _.compact(result.prioritySpaces.map(prioritySpace => {
                        if (prioritySpace.priority.location.city == city) {
                            return prioritySpace;
                        }
                    }));
                }
                result.count = await Builder.countDocuments(condition);
                return result;
            } else {
                let result = {};
                const priorityType = manageWorkSpaceService._createDynamicPriorityType(type) + '.is_active';
                const priorityTypeOrder = manageWorkSpaceService._createDynamicPriorityType(type) + '.order';
                let condition = {
                    [priorityType]: true,
                    city: city
                };
                result.prioritySpaces = await BuilderPriority.find(condition)
                    .populate('builder')
                    .sort({
                        [priorityTypeOrder]: 1
                    });
                if (type === 'location') {
                    result.prioritySpaces = _.compact(result.prioritySpaces.map(prioritySpace => {
                        prioritySpace.builder.priority = prioritySpace.priority;
                        if (prioritySpace.city == city) {
                            return prioritySpace.builder;
                        }
                    }));
                }
                result.count = await BuilderPriority.countDocuments(condition);
                return result;
            }
        } catch (error) {
            throw (error);
        }
    }

    /** default lat long is used of Cyber Park Sector 67, Gurugram, Haryana 122005 */
    _setGeoLocation({ latitude = 28.549670700000004, longitude = 77.21564350000001 }) {
        return {
            type: 'Point',
            coordinates: [+longitude, +latitude]
        }
    }

    async _createSlug(id, name, location) {
        try {
            if (id) {
                const ws = await Builder.findOne({ _id: id });
                if (ws && ws.slug) {
                    return ws.slug;
                }
            }
            let slugName = `${name} ${location}`;
            slugName = slugName.toString().toLowerCase()
                .replace(/\s+/g, '-') // Replace spaces with -
                .replace(/[^\w\-]+/g, '') // Remove all non-word chars
                .replace(/\-\-+/g, '-') // Replace multiple - with single -
                .replace(/^-+/, '') // Trim - from start of text
                .replace(/-+$/, ''); // Trim - from end of text
            const ws = await Builder.findOne({ slug: slugName });
            if (ws) {
                slugName = ws.slug + '-' + crypto.randomBytes(2).toString('hex');
            }
            return slugName;
        } catch (error) {
            throw (error);
        }
    }

    async deleteBuilder({ id }) {
        try {
            const os = await Builder.findOne({ _id: id }).populate('images.image');
            os && os.images.forEach(async (imageObject) => {
                const folder_name = FileUpload.findFolderFromPath(imageObject.image.s3_link);
                await Image.deleteOne({ _id: imageObject.image._id });
                await FileUtility.deleteFile(imageObject.image.name, folder_name);
            });
            await Builder.deleteOne({ _id: id });
            return true;
        } catch (error) {
            throw (error);
        }
    }

    async changeSlugById({ id, slug }) {
        try {
            const os = await Builder.findOne({ slug, _id: { $nin: [id] } });
            if (os) {
                this._throwException('Opps! Slug is already used by another Co-Living space');
            }
            await Builder.findOneAndUpdate({ _id: id }, { slug });
            return true;
        } catch (error) {
            throw (error);
        }
    }

    _throwException(message) {
        throw ({
            name: "cofynd",
            code: 400,
            message
        })
    }

    pad(n) {
        var s = "000" + n;
        return s.substr(s.length - 4);
    }
}

export default new ManageBuilderService();