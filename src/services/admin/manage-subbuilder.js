import models from '../../models/index.js';
import manageWorkSpaceService from './manage-work-space.js';
import crypto from 'crypto';
import FileUtility from '../../utilities/file.js';
import { findCountryByCoordinate } from "country-locator";
import {getCountry} from 'country-currency-map';
import FileUpload from '../../controllers/common/fileUpload.js'
const SubBuilder = models['SubBuilder'];
const Image = models['Image'];
const MicroLocation = models['MicroLocation'];
const Country = models['Country'];


class ManageSubBuilderService {
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
            getSubBuilders: this.getSubBuilders.bind(this),
            getSubBuildersById: this.getSubBuildersById.bind(this),
            createSubBuilder: this.createSubBuilder.bind(this),
            updateSubBuilder: this.updateSubBuilder.bind(this),
            addPrioritySubBuilder: this.addPrioritySubBuilder.bind(this),
            setPriorityByType: this.setPriorityByType.bind(this),
            changeSubBuilderStatus: this.changeSubBuilderStatus.bind(this),
            deleteSubBuilder: this.deleteSubBuilder.bind(this),
            changeSlugById: this.changeSlugById.bind(this),
            getPriorityBuilders: this.getPriorityBuilders.bind(this),
            spaceOrderByDrag: this.spaceOrderByDrag.bind(this)
        }
    }

    async getSubBuilders({ limit = 10, sortBy = 'name', orderBy = 1, skip, name, builder, city,project_type, location, micro_location, shouldApprove = false, userid, status }) {
        try {
            let result = {};
            let condition = {};
            if (name) {
                /** TODO $text search will be implemented */
                name = name.replace(/[^A-Za-z0-9 ]/g, "");
                condition['name'] = { $regex: `.*${name}.*`, $options: 'i' };
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
            if(project_type){
                condition['status'] = 'approve';
                condition['overview.project_type'] = project_type
            }
            if (builder) {
                condition['builder'] = builder;
            }
            result.builders = await SubBuilder.find(condition)
                .populate('plans.planId')
                .populate('builder')
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
            result.count = await SubBuilder.countDocuments(condition);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async getSubBuildersById({ subbuilderId }) {
        try {
            const builders = await SubBuilder.findOne({ _id: subbuilderId })
                .populate('amenties')
                .populate('allAmenities.residential')
                .populate('allAmenities.commercial')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('user')
                .populate('seo.open_graph.image')
            return builders;
        } catch (error) {
            throw error;
        }
    }

    async createSubBuilder({
        name,
        description,
        isOfficeSpace,
        isMoreCommercial,
        isTopCommercial,
        ratings,
        spaceTag,
        tagline,
        overview,
        plans,
        email,
        contact_details,
        website_Url,
        images,
        social_media,
        location,
        seo,
        user,
        added_by_user,
        amenties,
        allAmenities,
        builder,
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
                geometry = this._setGeoLocation(location);
                const countryInfo = findCountryByCoordinate(+location.latitude, +location.longitude);
                let country_name = countryInfo.name;
                let currency_code = getCountry(country_name).currency;
            }
            if (name & location.name) {
                const country_details = await Country.findOne({ _id: location.country });
                currency_code = getCountry(country_details.name).currency;
                country_dbname = country_details.name;
            }
            return await SubBuilder.create({
                name,
                description,
                isOfficeSpace,
                isMoreCommercial,
                isTopCommercial,
                ratings,
                spaceTag,
                tagline,
                overview,
                plans,
                email,
                contact_details,
                website_Url,
                images,
                social_media,
                location,
                seo,
                user,
                added_by_user,
                currency_code,
                country_dbname,
                slug,
                expireAt,
                amenties,
                allAmenities,
                builder,
                geometry
            })
        } catch (error) {
            throw error;
        }
    }

    async updateSubBuilder({
        id,
        name,
        description,
        isOfficeSpace,
        isMoreCommercial,
        isTopCommercial,
        ratings,
        spaceTag,
        tagline,
        overview,
        plans,
        email,
        contact_details,
        website_Url,
        images,
        social_media,
        location,
        seo,
        user,
        added_by_user,
        amenties,
        allAmenities,
        builder,
        slug
    }) {
        try {
            const geometry = this._setGeoLocation(location);
            const countryInfo = findCountryByCoordinate(+location.latitude, +location.longitude);
            let country_name = countryInfo.name;
            let currency_code = getCountry(country_name).currency;
            const country_details = await Country.findOne({ _id: location.country });
            let country_dbname = country_details.name;
            return await SubBuilder.findOneAndUpdate({ _id: id }, {
                name,
                description,
                overview,
                isOfficeSpace,
                isMoreCommercial,
                isTopCommercial,
                ratings,
                spaceTag,
                tagline,
                plans,
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
                amenties,
                allAmenities,
                builder,
                geometry
            })
        } catch (error) {
            throw error;
        }
    }

    async changeSubBuilderStatus({ subbuilderId, status }) {
        try {
            return await SubBuilder.findOneAndUpdate({ _id: subbuilderId }, { $set: { status } });
        } catch (error) {
            throw error;
        }
    }
    _createDynamicPriorityType(type) {
        let object = 'priority.overall';
        switch (type) {
            case 'commercial':
                object = 'priority.commercial';
                break;
            case 'residential':
                object = 'priority.residential';
                break;
            default:
                object = 'priority.overall';
                break;
        }
        return object;
    }

    async addPrioritySubBuilder({ id, type, data }) {
        try {
            let object = this._createDynamicPriorityType(type);
            console.log(object)
            if (!data.is_active) {
                const { priority } = await SubBuilder.findOne({ _id: id }, { priority: 1 });
                const priorityOrder = object + '.order';
                const priorityActive = object + '.is_active';
                const condition = {
                    [priorityOrder]: { $gt: priority[type].order },
                    [priorityActive]: true
                };
                if (data.city) {
                    condition['location.city'] = data.city;
                }
                await SubBuilder.updateMany(condition, {
                    $inc: {
                        [priorityOrder]: -1
                    }
                });
            }
            await SubBuilder.updateOne({ '_id': id }, {
                $set: {
                    [object]: data
                }
            });
            return true;
        } catch (error) {
            throw (error);
        }
    }

    async setPriorityByType({ initialPosition, finalPosition, shiftedId, type }) {
        try {
            const priorityOrder = manageWorkSpaceService._createDynamicPriorityType(type) + '.order';
            const priorityActive = manageWorkSpaceService._createDynamicPriorityType(type) + '.is_active';
            if (initialPosition < finalPosition) {
                await SubBuilder.updateMany({
                    [priorityOrder]: { $lte: finalPosition, $gt: initialPosition },
                    [priorityActive]: true
                }, {
                    $inc: {
                        [priorityOrder]: -1
                    }
                })
                await SubBuilder.updateOne({ _id: shiftedId }, {
                    $set: {
                        [priorityOrder]: finalPosition
                    }
                })
            }
            if (initialPosition > finalPosition) {
                await SubBuilder.updateMany({
                    [priorityOrder]: { $lt: initialPosition, $gte: finalPosition },
                    [priorityActive]: true
                }, {
                    $inc: {
                        [priorityOrder]: 1
                    }
                })
                await SubBuilder.updateOne({ _id: shiftedId }, {
                    $set: {
                        [priorityOrder]: finalPosition
                    }
                })
            }
        } catch (e) {
            throw (e)
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
                const ws = await SubBuilder.findOne({ _id: id });
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
            const ws = await SubBuilder.findOne({ slug: slugName });
            if (ws) {
                slugName = ws.slug + '-' + crypto.randomBytes(2).toString('hex');
            }
            return slugName;
        } catch (error) {
            throw (error);
        }
    }

    async deleteSubBuilder({ id }) {
        try {
            const os = await SubBuilder.findOne({ _id: id }).populate('images.image');
            os && os.images.forEach(async(imageObject) => {
                const folder_name = FileUpload.findFolderFromPath(imageObject.image.s3_link);
                await Image.deleteOne({ _id: imageObject.image._id });
                await FileUtility.deleteFile(imageObject.image.name, folder_name);
            });
            await SubBuilder.deleteOne({ _id: id });
            return true;
        } catch (error) {
            throw (error);
        }
    }

    async changeSlugById({ id, slug }) {
        try {
            const os = await SubBuilder.findOne({ slug, _id: { $nin: [id] } });
            if (os) {
                this._throwException('Opps! Slug is already used by another Co-Living space');
            }
            await SubBuilder.findOneAndUpdate({ _id: id }, { slug });
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
    async getPriorityBuilders({ type, city }) {
        try {
                if(type === 'commercial' || type === 'residential'){
                let result = {};
                const priorityType = this._createDynamicPriorityType(type) + '.is_active';
                const priorityTypeOrder = this._createDynamicPriorityType(type) + '.order';
                let condition = {
                    [priorityType]: true,
                   'location.city': city,
                   'overview.project_type': type
                };
                result.prioritySpaces = await SubBuilder.find(condition)
                    // .populate('builder')
                    .sort({
                        [priorityTypeOrder]: 1
                    });
                    return result
                }
        } catch (error) {
            throw (error);
        }
    }
    async spaceOrderByDrag ({updatedProjects, type}) {
        try {
          for (const project of updatedProjects) {
            const { _id, priority } = project;
            if(type === 'commercial'){
                await SubBuilder.findByIdAndUpdate(_id, {
                    $set: {
                      "priority.commercial.order": priority.commercial.order,
                      "priority.commercial.is_active": priority.commercial.order !== 1000,
                    },
                  });
            }
            if(type === 'residential'){
                await SubBuilder.findByIdAndUpdate(_id, {
                    $set: {
                      "priority.residential.order": priority.residential.order,
                      "priority.residential.is_active": priority.residential.order !== 1000,
                    },
                  });
            }
          }
        } catch (error) {
          throw error
        }
    }
}

export default new ManageSubBuilderService();