import models from '../../models/index.js';

const SubBuilder = models['SubBuilder'];
const MicroLocation = models['MicroLocation'];
const Flats = models['Flats'];
const Builder = models['Builder']

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
            getApartmentForRentOrSale: this.getApartmentForRentOrSale.bind(this),
            getBuilderslocation: this.getBuilderslocation.bind(this)
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

    async getSubBuilders({ limit = 10, orderBy = 1, skip, name, city, location, micro_location,builder_name, shouldApprove = false, userid, filter_by, builder }) {
        try {
            let result = {};    
            let condition = {};
            let sortBy;
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
                condition['is_active'] = true;
            }
            if (userid) {
                condition['user'] = userid;
            }
            if (filter_by) {
                condition['overview.project_type'] = filter_by;
            }
            if (builder) {
                condition['builder'] = builder;
            }
            if (builder_name) {
                builder_name = builder_name.replace(/[^A-Za-z0-9 ]/g, "");
                let builders = await Builder.find({name: { '$regex': `^(\s+${builder_name}|^${builder_name})`, '$options': 'i' }});
                condition['builder'] = builders[0]._id;
            }
            condition['status'] = 'approve';
            result.builders = await SubBuilder.find(condition)
                .populate('plans.planId')
                .populate('builder')
                .populate('location.micro_location')
                .populate('location.city')
                .populate('location.country')
                .populate('images.image')
                .populate('amenties')
                .populate('allAmenities.residential')
                .populate('allAmenities.commercial')
                .populate('user')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                // .limit(limit)
                // .skip(skip) 
                // .sort({
                //     [sortBy]: orderBy
                // });
            if(filter_by === 'commercial'){
                result.builders.sort((a,b) => {
                    return a.priority.commercial.order - b.priority.commercial.order
                }) 
            } 
            if(filter_by === 'residential'){
                result.builders.sort((a,b) => {
                    return a.priority.residential.order - b.priority.residential.order
                }) 
            }
            result.builders.map((item, index) => {
                item.allAmenities.commercial.sort((a,b) => a.priority.for_office.order - b.priority.for_office.order);
                item.allAmenities.residential.sort((a,b) => a.priority.for_flatspace.order - b.priority.for_flatspace.order);
            })  
            result.count = await SubBuilder.countDocuments(condition);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async getSubBuildersById({ findKey, builderName }) {
        try {
            let condition = null;
            if(builderName && findKey){
                if (findKey.match(/^[0-9a-fA-F]{24}$/)) {
                    condition = { _id: findKey } // Yes, it's a valid ObjectId, proceed with `findById` call.
                } else {
                    condition = { slug: findKey.trim() }
                }
                // builderName = builderName.replace(/[^A-Za-z0-9 ]/g, "");
                // let regexPattern = '^' + builderName.split('').join('[\\s-]*') + '[\\s-]*$';
                let builders = await Builder.find({ slug: builderName.trim() });
                    condition['builder'] = builders[0]?._id;
            } 
            condition['status'] = 'approve';
            const builders = await SubBuilder.findOne(condition)
                .populate('plans.planId')
                .populate('builder')
                .populate('amenties')
                .populate('allAmenities.residential')
                .populate('allAmenities.commercial')
                .populate('location.country')
                .populate('location.city')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('user')
                .populate('seo.open_graph.image')
            return builders;
        } catch (error) {
            throw error;
        }
    }

    async getApartmentForRentOrSale({ limit = 10, sortBy = 'name', orderBy = 1, skip, name, city, location, micro_location, shouldApprove = false, userid, filter_by, builder, subbuilder, for_rent, for_sale }) {
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
            if (filter_by) {
                condition['overview.project_type'] = filter_by;
            }
            if (builder) {
                condition['builder'] = builder;
            }
            if (subbuilder) {
                condition['subbuilder'] = subbuilder;
            }
            if (for_rent) {
                condition['for_rent'] = true;
            }
            if (for_sale) {
                condition['for_sale'] = true;
            }
            result.builders = await Flats.find(condition)
                .populate('location.city')
                .populate('location.country')
                .populate('images.image')
                .populate('coliving_plans.planId')
                .populate('user')
                .populate('builder')
                .populate('subbuilder')
                .limit(limit)
                .skip(skip)
                .sort({
                    createdAt: -1
                });
            result.count = await Flats.countDocuments(condition);
            return result;
        } catch (error) {
            throw error;
        }
    }
    async getBuilderslocation({city, builder_name, filter_by}){
        try {
            let result = {};
            let condition = {};
            let location = []
            if(city){
                condition['location.city'] = city
            }
            if (builder_name) {
                builder_name = builder_name.replace(/[^A-Za-z0-9 ]/g, "");
                let builders = await Builder.find({name: { '$regex': `^(\s+${builder_name}|^${builder_name})`, '$options': 'i' }});
                condition['builder'] = builders[0]._id;
            }
            if (filter_by) {
                condition['overview.project_type'] = filter_by;
            }
            condition['status'] = 'approve';
            result.buildings = await SubBuilder.find(condition)
                .populate('plans.planId')
                .populate('builder')
                .populate('location.micro_location')
                .populate('location.city')
                .populate('location.country')
                .populate('images.image')
                .populate('amenties')
                .populate('allAmenities.residential')
                .populate('allAmenities.commercial')
                .populate('user')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                result.buildings.forEach((item) => {
                    location.push(item.location.micro_location)
                })
                const uniqueArray = location.filter((obj, index, array) =>
                      array.findIndex((o) => o.id === obj.id) === index
                );
                result.location = uniqueArray
                return result
        } catch (error) {
            throw error;
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

export default new ManageSubBuilderService();