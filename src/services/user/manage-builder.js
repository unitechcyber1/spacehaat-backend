import models from '../../models/index.js';
import manageWorkSpaceService from '../admin/manage-work-space.js';
import _ from 'lodash';
const Builder = models['Builder'];
const MicroLocation = models['MicroLocation'];
const SubBuilder = models['SubBuilder'];
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
            getBuildersByName: this.getBuildersByName.bind(this),
            getBuilderComResiProjects: this.getBuilderComResiProjects.bind(this),
            getPriorityBuilders: this.getPriorityBuilders.bind(this)
        }
    }

    async getBuilders({
        limit = 10, skip,
        name,
        city,
        location,
        micro_location,
        shouldApprove = false,
        userid,
        sortBy = 'priority.overall.order',
        sortType = 1,
        type
    }) {
        try {
            let result = {};
            let condition = {};
            let priorityTypeOrder;
            let allBuilders = [];
            if (name) {
                /** TODO $text search will be implemented */
                name = name.replace(/[^A-Za-z0-9 ]/g, "");
                condition['name'] = { '$regex': `^(\s+${name}|^${name})`, '$options': 'i' };
            }
            if (city) {
                const priorityType = manageWorkSpaceService._createDynamicPriorityType(type) + '.is_active';
                priorityTypeOrder = manageWorkSpaceService._createDynamicPriorityType(type) + '.order';
                condition = {
                    [priorityType]: true,
                    city: city
                };
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
            if (city) {
                result.builders = await BuilderPriority.find(condition)
                    .populate('builder')
                    .sort({
                        [priorityTypeOrder]: 1
                    });
                if (type === 'location') {
                    result.builders = _.compact(result.builders.map(prioritySpace => {
                        prioritySpace.builder.priority = prioritySpace.priority;
                        if (prioritySpace.city == city) {
                            allBuilders.push(prioritySpace.builder.id);
                            return prioritySpace.builder;
                        }
                    }));
                }
                result.builders = await Builder.find({ _id: { $in: allBuilders } }).populate('builder_logo')
                .populate('images.image').sort({_id:1})
                result.count = await BuilderPriority.countDocuments(condition);
                return result;
            } else {
                condition['status'] = 'approve';
                result.builders = await Builder.find(condition)
                    .populate('location.micro_location')
                    .populate('location.city')
                    .populate('location.country')
                    .populate('images.image')
                    .populate('user')
                    .limit(limit)
                    .skip(skip)
                    .sort({
                        [sortBy]: sortType
                    });
                result.count = await Builder.countDocuments(condition);
                return result;
            }
        } catch (error) {
            throw error;
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

    async getBuildersById({ findKey }) {
        try {
            let condition = null;
            if (findKey.match(/^[0-9a-fA-F]{24}$/)) {
                condition = { _id: findKey } // Yes, it's a valid ObjectId, proceed with `findById` call.
            } else {
                condition = { slug: findKey }
            }
            condition['status'] = 'approve';
            const builders = await Builder.findOne(condition)
                // .populate('amenties')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('user')
                .populate('seo.open_graph.image')
                .populate('location.country')
                // .populate('sleepimg')
                .populate('builder_logo')
            return builders;
        } catch (error) {
            throw error;
        }
    }

    async getBuildersByName({ builderId }) {
        try {
            const builders = await Builder.findOne({ name: builderId })
                // .populate('amenties')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('user')
                .populate('seo.open_graph.image')
                .populate('location.country')
                // .populate('sleepimg')
                .populate('builder_logo')
            return builders;
        } catch (error) {
            throw error;
        }
    }

    async getBuilderComResiProjects({ limit = 100, sortBy = 'name', orderBy = 1, skip, name, city, location, micro_location, shouldApprove = false, userid, findKey, builder, is_rent }) {
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
            if (findKey) {
                condition['overview.project_type'] = findKey;
            }
            if (is_rent) {
                condition['overview.is_rent'] = is_rent;
            }
            if (builder) {
                condition['builder'] = builder;
            }
            result.subbuilders = await SubBuilder.find(condition)
                .populate('location.micro_location')
                .populate('location.city')
                .populate('builder')
                .populate('location.country')
                .populate('images.image')
                .populate('user')
                .populate('amenties')
                .populate('plans.planId')
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

    /** default lat long is used of Cyber Park Sector 67, Gurugram, Haryana 122005 */
    _setGeoLocation({ latitude = 28.549670700000004, longitude = 77.21564350000001 }) {
        return {
            type: 'Point',
            coordinates: [+longitude, +latitude]
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