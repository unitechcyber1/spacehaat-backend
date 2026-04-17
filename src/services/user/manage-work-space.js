import models from '../../models/index.js';
import axios from 'axios';
import app from '../../config/app.js';
import { ObjectId } from 'mongodb';
import _ from 'lodash';
import manageWorkSpaceService from '../admin/manage-work-space.js';
const WorkSpace = models['WorkSpace'];
const MicroLocation = models['MicroLocation']

const blackListWS = [
    'abl-workspaces-dlf-cyber-hub-gurugram',
    'abl-workspaces-golf-course-road-e773-gurugram',
    'deskin-coworking-solutions',
    'grafio-hub-2-&-3',
    'incubex-nestavera-hsr2',
    'innov8-dlf-cyber-hub-gurugram',
    'innov8-sohna-road-gurugram',
    'innov8-dlf-cyber-city-gurugram',
    'innov8-film-city-film-city-noida',
    'oyo-powerstation-golf-course-extension-gurugram',
    'spring-house-golf-course-road-a977-gurugram',
    'spring-house-sector-44-dd59-gurugram',
    'the-office-pass-sector-39-gurugram',
]

function escapeRegex(string) {
    return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Returns ObjectId only for a valid 24-char hex id; avoids BSONError on bad query params */
function parseObjectIdParam(value) {
    if (value == null || value === '') {
        return null;
    }
    const s = String(value).trim();
    if (!/^[a-fA-F0-9]{24}$/.test(s)) {
        return null;
    }
    return new ObjectId(s);
}

const filteredFields = {
    name: 1,
    description: 1,
    email: 1,
    contact_details: 1,
    website_Url: 1,
    images: 1,
    amenties: 1,
    social_media: 1,
    seo: 1,
    location: 1,
    hours_of_operation: 1,
    geometry: 1,
    rooms: 1,
    no_of_seats: 1,
    plans: 1,
    likes: 1,
    is_active: 1,
    status: 1,
    brand: 1,
    slug: 1,
    priority: 1,
    is_popular: 1,
    small_team_availability: 1,
    enterprise_availability: 1
}

class ManageWorkSpaceService {
    constructor() {
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };
        return {
            getWorkSpaces: this.getWorkSpaces.bind(this),
            getWorkSpaces_country_wise: this.getWorkSpaces_country_wise.bind(this),
            getWorkSpaceById: this.getWorkSpaceById.bind(this),
            getPopularWorkSpaces: this.getPopularWorkSpaces.bind(this),
            getPopularWorkSpacesCountryWise: this.getPopularWorkSpacesCountryWise.bind(this),
            getWorkSpacesCountryWise: this.getWorkSpacesCountryWise.bind(this),
            getPriorityWorkSpaces: this.getPriorityWorkSpaces.bind(this),
            getSimilarPlacesByLocation: this.getSimilarPlacesByLocation.bind(this),
            getPopularPlacesByKey: this.getPopularPlacesByKey.bind(this),
            getNearBySpaces: this.getNearBySpaces.bind(this)
        }
    }
    async getWorkSpaces({
        limit = 10,
        sortBy = 'priority.overall.order',
        sortType = 1,
        micro_location,
        orderBy,
        skip,
        slug,
        amenties,
        minPrice = 0,
        maxPrice = 100000,
        city,
        latitude,
        longitude,
        enterprise_availability,
        small_team_availability,
        is_near_metro,
        is_sunday_open,
        is_open_24,
        name,
        id: userId,
        space_type,
        for_virtual,
        locations,
        virtual
    }) {
        try {
            let condition = { status: 'approve', slug: { $nin: blackListWS } };
            let result = {};
            let aggregatePipeline = [];
            let parseLocations;

            if (locations) {
                parseLocations = JSON.parse(locations);
            }

            // Distance querys
            if (latitude && longitude) {
                const result = await this._getWorkSpacesByDistnace(longitude, latitude, minPrice, maxPrice, limit, skip, orderBy, sortType);
                return result;
            }

            if (is_sunday_open) {
                is_sunday_open = (is_sunday_open.toLowerCase() == 'true');
                condition['$or'] = [
                    { 'hours_of_operation.sunday.is_closed': !is_sunday_open },
                    { 'hours_of_operation.sunday.is_open_24': true }
                ];
            }

            if (is_open_24) condition['hours_of_operation.monday.is_open_24'] = is_open_24;
            if (is_near_metro) condition['location.is_near_metro'] = Boolean(is_near_metro);
            if (enterprise_availability) condition['enterprise_availability'] = enterprise_availability;
            if (small_team_availability) condition['small_team_availability'] = small_team_availability;
            if (slug) condition['slug'] = slug;

            if (name != null && String(name).trim() !== '') {
                const term = escapeRegex(String(name).trim());
                condition.name = { $regex: term, $options: 'i' };
            }

            const cityId = parseObjectIdParam(city);
            if (cityId) {
                condition['location.city'] = cityId;
                sortBy = manageWorkSpaceService._createDynamicPriorityType('location') + '.order';
            }

            const microLocationId = parseObjectIdParam(micro_location);
            if (microLocationId) {
                condition['location.micro_location'] = microLocationId;
                sortBy = manageWorkSpaceService._createDynamicPriorityType('micro_location') + '.order';
            }

            if (amenties) {
                amenties = amenties.split(',');
                condition['amenties'] = { '$in': amenties };
            }

            if (parseLocations && Array.isArray(parseLocations)) {
                const objectIdLocations = parseLocations
                    .map((id) => parseObjectIdParam(id))
                    .filter(Boolean);
                if (objectIdLocations.length > 0) {
                    condition['location.micro_location'] = { $in: objectIdLocations };
                }
            }

            if (space_type) {
                condition['plans'] = {
                    $elemMatch: {
                        'category': space_type,
                    }
                };
            }

            if (minPrice && maxPrice !== 100000) {
                aggregatePipeline.push(
                    {
                        $addFields: {
                            plans: {
                                $filter: {
                                    input: '$plans',
                                    as: 'plan',
                                    cond: {
                                        $and: [
                                            { $gte: ['$$plan.price', +minPrice] },
                                            { $lte: ['$$plan.price', +maxPrice] },
                                            { $eq: ['$$plan.duration', 'month'] }
                                        ]
                                    }
                                }
                            }
                        }
                    },
                    {
                        $match: {
                            plans: { $ne: [] }
                        }
                    }
                );
            }

            if (minPrice && maxPrice && space_type) {
                condition['plans'] = {
                    $elemMatch: {
                        'price': { $gte: +minPrice, $lte: +maxPrice },
                        'duration': 'month',
                        'category': space_type,
                    }
                };
            }

            if (for_virtual) {
                condition['plans'] = {
                    $elemMatch: {
                        'duration': 'year',
                        'category': '6231bca42a52af3ddaa73ab1',
                    }
                };
            }

            if (virtual) {
                const virtualId = [
                    '681075096db4f288ebc096fc',
                    '681074d76db4f288ebc06e58',
                    '681074ed6db4f288ebc080e5'
                ];
                const objectId = virtualId.map(id => new ObjectId(id));
                condition['plans'] = {
                    $elemMatch: {
                        category: { $in: objectId }
                    }
                };
                // Removed sortBy override here to use dedicated sorting stage
            }

            // Common aggregation pipeline
            aggregatePipeline.push(
                { $match: condition },
                {
                    $lookup: {
                        from: 'images',
                        localField: 'images.image',
                        foreignField: '_id',
                        as: 'imageDetails'
                    }
                },
                {
                    $addFields: {
                        images: {
                            $map: {
                                input: '$images',
                                as: 'image',
                                in: {
                                    $mergeObjects: [
                                        '$$image',
                                        {
                                            image: {
                                                $arrayElemAt: [
                                                    '$imageDetails',
                                                    { $indexOfArray: ['$imageDetails._id', '$$image.image'] }
                                                ]
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    }
                },
                {
                    $lookup: {
                        from: 'brands',
                        localField: 'brand',
                        foreignField: '_id',
                        as: 'brand'
                    }
                },
                {
                    $addFields: {
                        brand: { $arrayElemAt: ['$brand', 0] }
                    }
                },
                {
                    $lookup: {
                        from: 'images',
                        localField: 'brand.image',
                        foreignField: '_id',
                        as: 'brand.imageDetails'
                    }
                },
                {
                    $addFields: {
                        'brand.image': {
                            $arrayElemAt: ['$brand.imageDetails', 0]
                        }
                    }
                },
                {
                    $lookup: {
                        from: 'cities',
                        localField: 'location.city',
                        foreignField: '_id',
                        as: 'location.city'
                    }
                },
                {
                    $addFields: {
                        'location.city': {
                            $arrayElemAt: ['$location.city', 0]
                        }
                    }
                },
                {
                    $lookup: {
                        from: 'microlocations',
                        localField: 'location.micro_location',
                        foreignField: '_id',
                        as: 'location.micro_location'
                    }
                },
                {
                    $addFields: {
                        'location.micro_location': {
                            $arrayElemAt: ['$location.micro_location', 0]
                        }
                    }
                },
                {
                    $project: {
                        name: 1,
                        images: 1,
                        location: 1,
                        priority: 1,
                        virtual_priority: 1,
                        brand: 1,
                        plans: 1,
                        slug: 1,
                        space_contact_details: 1,
                        spaceTag: 1,
                        ratings: 1,
                        country_dbname: 1,
                        status: 1,
                        currency_code: 1
                    }
                }
            );

            // Dynamic sorting handling
            if (virtual) {
                aggregatePipeline.push(
                    {
                        $addFields: {
                            virtual_order_sort: {
                                $ifNull: ['$virtual_priority.location.order', 999999]
                            }
                        }
                    },
                    {
                        $sort: {
                            virtual_order_sort: 1
                        }
                    }
                );
            } else {
                aggregatePipeline.push(
                    {
                        $sort: { [sortBy]: sortType }
                    }
                );
            }

            // Pagination
            aggregatePipeline.push(
                { $skip: skip || 0 },
                { $limit: limit || 10 }
            );
            const workSpaces = await WorkSpace.aggregate(aggregatePipeline);
            const totalWorkSpaces = await WorkSpace.countDocuments(condition);
            result.count = totalWorkSpaces;
            result.workSpaces = workSpaces;
            return result;

        } catch (error) {
            throw error;
        }
    }



    async getWorkSpaces_country_wise({
        limit = 10,
        sortBy = 'priority.overall.order',
        sortType = 1,
        micro_location,
        orderBy,
        skip,
        slug,
        amenties,
        minPrice = 0,
        maxPrice = 100000,
        city,
        latitude,
        longitude,
        enterprise_availability,
        small_team_availability,
        is_near_metro,
        is_sunday_open,
        is_open_24,
        name,
        country_id,
        id: userId
    }) {
        try {
            let condition = { status: 'approve', 'location.country': country_id, slug: { $nin: blackListWS } };
            let result = {};
            let workSpaces = null;
            if (latitude && longitude) {
                const result = await this._getWorkSpacesByDistnace(longitude, latitude, minPrice, maxPrice, limit, skip, orderBy, sortType);
                return result;
            }
            if (is_sunday_open) {
                is_sunday_open = (is_sunday_open.toLowerCase() == 'true');
                condition['$or'] = [
                    { 'hours_of_operation.sunday.is_closed': !is_sunday_open },
                    { 'hours_of_operation.sunday.is_open_24': true }
                ];
            }
            if (is_open_24) {
                condition['hours_of_operation.monday.is_open_24'] = is_open_24;
            }
            if (is_near_metro) {
                condition['location.is_near_metro'] = is_near_metro;
            }
            if (enterprise_availability) {
                condition['enterprise_availability'] = enterprise_availability;
            }
            if (small_team_availability) {
                condition['small_team_availability'] = small_team_availability;
            }
            if (slug) {
                condition['slug'] = slug;
            }
            if (name) {
                const googleResults = await this.getSpaceByLocation(name);
                name = '.*' + name + '.*';
                condition['name'] = { $regex: new RegExp('^' + name + '$', 'i') };
                result.googleResults = googleResults;
            }
            if (city) {
                condition['location.city'] = city;
                sortBy = manageWorkSpaceService._createDynamicPriorityType('location') + '.order';
            }
            if (micro_location) {
                sortBy = manageWorkSpaceService._createDynamicPriorityType('micro_location') + '.order';
            }
            if (amenties) {
                amenties = amenties.split(',');
                condition['amenties'] = { '$in': amenties };
            }
            if (minPrice && maxPrice) {
                condition['plans'] = {
                    $elemMatch: {
                        'price': { $gte: +minPrice, $lte: +maxPrice }
                    }
                };
            }
            workSpaces = await WorkSpace.find(condition)
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .populate('brand')
                .populate('location.city')
                .limit(limit)
                .skip(skip)
                .sort({
                    [sortBy]: sortType
                });
            const toalWorkSpaces = await WorkSpace.find(condition);
            result.count = toalWorkSpaces.length;
            result.workSpaces = this._checkUserFavorite(workSpaces, userId, minPrice, maxPrice);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async _getWorkSpacesByDistnace(longitude, latitude, minPrice, maxPrice, limit, skip, orderBy, sortKey = 'micro_location', sortType = -1) {
        let filters = Object.assign({}, filteredFields, {
            plans: {
                $filter: {
                    input: "$plans",
                    as: "plans",
                    cond: {
                        $and: [
                            { $gte: ["$$plans.price", +minPrice] },
                            { $lte: ["$$plans.price", +maxPrice] }
                        ]
                    }
                }
            }
        })
        let workSpaces = await WorkSpace.aggregate([{
            $geoNear: {
                near: { type: "Point", coordinates: [+longitude, +latitude] },
                distanceField: "distance",
                maxDistance: 10 * 500, // IN KM,
                spherical: true
            },
        },
        {
            $match: {
                $and: [
                    { status: 'approve' },
                    { plans: { $elemMatch: { 'price': { $gte: +minPrice, $lte: +maxPrice } } } },
                    { slug: { $nin: blackListWS } }
                ]
            }
        },
        {
            $project: filters
        },
        { $addFields: { 'id': '$_id' } },
        { $sort: { distance: orderBy, [sortKey]: sortType } },
        {
            $facet: {
                metadata: [{ $count: "count" }],
                result: [{ $skip: skip }, { $limit: limit }]
            }
        }
        ]);
        return await this._sanitizeApiResponse(workSpaces);
    }

    async getWorkSpaceById({ findKey, id: userId }) {
        try {
            let condition = null;
            if (findKey.match(/^[0-9a-fA-F]{24}$/)) {
                condition = { _id: findKey } // Yes, it's a valid ObjectId, proceed with `findById` call.
            } else {
                condition = { slug: findKey }
            }
            condition['status'] = 'approve';
            let workSpace = await WorkSpace.findOne(condition)
                .populate('amenties')
                .populate('location.city')
                .populate('location.micro_location')
                .populate('images.image')
                .populate('plans.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .populate('plans.category')
                .populate({
                    path: 'brand',
                    populate: {
                        path: 'image',
                    },
                })
                .exec().then(async (user) => {
                    const data = await WorkSpace.populate(user, 'plans.category.icons')
                    return data
                })
            if (!workSpace) {
                this._throwException('Not Found');
            }
            let is_favorite = await workSpace.likes && workSpace.likes.find(x => x == userId);
            is_favorite = await is_favorite ? true : false;
            return Object.assign({}, workSpace.toObject(), { is_favorite });
        } catch (error) {
            throw error;
        }
    }

    //radius in meters means radius around the given lat lng ie delhi circle by default
    async getNearBySpaces({ lat, long, slug, microlocation, limit = 20, page = 1, city }) {
        try {
            let condition = {}
            let result = {};
            if (slug) {
                const livspace = await WorkSpace.findOne({ slug })
                if (!livspace) {
                    return res.status(404).send("Coliving not found");
                }
                let spaces = await WorkSpace.find({
                    _id: { $ne: livspace._id },
                    "status": "approve",
                    "location.city": city,
                    "location.latitude": {
                        $gte: livspace.location.latitude - 0.027,
                        $lte: livspace.location.latitude + 0.027,
                    },
                    "location.longitude": {
                        $gte: livspace.location.longitude - 0.027,
                        $lte: livspace.location.longitude + 0.027,
                    },
                })
                    .populate('images.image')
                    .populate('seo.twitter.image')
                    .populate('seo.open_graph.image')
                    .populate('brand')
                    .populate('location.city')
                    .populate({
                        path: 'brand',
                        populate: {
                            path: 'image',
                        },
                    })
                if (microlocation) {
                    const name = { $regex: `^${microlocation}$`, $options: "i" };
                    const location = await MicroLocation.findOne({ name, city })
                    if (location) {
                        condition['location.micro_location'] = {
                            $in: [location?._id]
                        };
                    }
                    condition['status'] = "approve"
                    var locationSpace = await WorkSpace.find(condition)
                        .populate('images.image')
                        .populate('seo.twitter.image')
                        .populate('seo.open_graph.image')
                        .populate('brand')
                        .populate('location.city')
                        .populate({
                            path: 'brand',
                            populate: {
                                path: 'image',
                            },
                        })
                }
                if (locationSpace) {
                    spaces = locationSpace.concat(spaces)
                }
                result.spaces = spaces;
                result.totalRecords = spaces.length
                return result
            }
            if (lat && long) {
                const latitude = parseFloat(lat)
                const longitude = parseFloat(long)
                let spaces = await WorkSpace.find({
                    "status": "approve",
                    "location.city": city,
                    "location.latitude": {
                        $gte: latitude - 0.027,
                        $lte: longitude + 0.027,
                    },
                    "location.longitude": {
                        $gte: latitude - 0.027,
                        $lte: longitude + 0.027,
                    },
                })
                    .populate('images.image')
                    .populate('seo.twitter.image')
                    .populate('seo.open_graph.image')
                    .populate('brand')
                    .populate('location.city')
                    .populate({
                        path: 'brand',
                        populate: {
                            path: 'image',
                        },
                    })
                if (microlocation) {
                    const name = { $regex: `^${microlocation}$`, $options: "i" };
                    const location = await MicroLocation.findOne({ name, city })
                    if (location) {
                        condition['location.micro_location'] = {
                            $in: [location?._id]
                        };
                    }
                    condition['status'] = "approve"
                    var locationSpace = await WorkSpace.find(condition)
                        .populate('images.image')
                        .populate('seo.twitter.image')
                        .populate('seo.open_graph.image')
                        .populate('brand')
                        .populate('location.city')
                        .populate({
                            path: 'brand',
                            populate: {
                                path: 'image',
                            },
                        })
                }
                if (locationSpace) {
                    spaces = locationSpace.concat(spaces)
                }
                result.spaces = spaces;
                result.totalRecords = spaces.length
                return result
            }
        } catch (error) {
            throw error
        }
    }
    async getSpaceByLocation(name, locationBias = { radius: 50000, lat: 28.4457, lng: 77.0824 }) {
        try {
            // const query = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${name}&language=en&location=${locationBias.lat},${locationBias.lng}&radius=${locationBias.radius}&strictbounds&region=IN&key=${app.googleApiKey}`
            // const query = `https://api.locationiq.com/v1/autocomplete.php?key=${app.locationIqApiKey}&q=${name}`
            const query = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name)}`
            const results = await axios.get(query);
            // return results.data.predictions.map(r => {
            //     return {
            //         address: r.description,
            //         placeId: r.place_id,
            //         name: r.terms[0].value
            //     }
            // });
            return results.data.map(r => {
                return {
                    address: r.display_name,
                    placeId: r.place_id,
                    name: r.address.name
                }
            });
        } catch (e) {
            throw (e)
        }
    }

    async getPopularWorkSpaces() {
        try {
            let result = {};
            let condition = { 'is_popular.value': true, slug: { $nin: blackListWS } };
            result.popularSpaces = await WorkSpace.find(condition)
                .populate('location.city')
                .populate('location.micro_location')
                .populate('brand')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .sort({ 'is_popular.order': 1 });
            result.count = await WorkSpace.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }
    async getPopularWorkSpacesCountryWise({ countryId }) {
        try {
            let result = {};
            let condition = { 'is_popular.value': true, 'location.country': countryId, slug: { $nin: blackListWS } };
            result.popularSpaces = await WorkSpace.find(condition)
                .populate('location.city')
                .populate('brand')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .sort({ 'is_popular.order': 1 });
            result.count = await WorkSpace.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }
    async getWorkSpacesCountryWise({ countryId }) {
        try {
            let result = {};
            let condition = { 'location.country': countryId, status: "approve" };
            result.popularSpaces = await WorkSpace.find(condition)
                .populate('location.city')
                .populate('brand')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .sort({ 'is_popular.order': 1 });
            result.count = await WorkSpace.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }

    // async getPriorityWorkSpaces({ type, city, virtual_priority = false }) {
    //     try {
    //         let result = {};
    //         const priorityType = manageWorkSpaceService._createDynamicPriorityType(type, virtual_priority) + '.is_active';
    //         const priorityTypeOrder = manageWorkSpaceService._createDynamicPriorityType(type, virtual_priority) + '.order';
    //         let condition = {
    //             [priorityType]: true,
    //             slug: { $nin: blackListWS }
    //         };
    //         result.prioritySpaces = await WorkSpace.find(condition)
    //             .populate('location.city')
    //             .populate('location.micro_location')
    //             .populate('brand')
    //             .populate('images.image')
    //             .populate('seo.twitter.image')
    //             .populate('seo.open_graph.image')
    //             .sort({
    //                 [priorityTypeOrder]: 1
    //             });
    //         if (type === 'location') {
    //             result.prioritySpaces = _.compact(result.prioritySpaces.map(prioritySpace => {
    //                 if (prioritySpace.priority.location.city == city) {
    //                     return prioritySpace;
    //                 }
    //             }));
    //         } else if (type === 'micro_location') {
    //             result.prioritySpaces = _.compact(result.prioritySpaces.map(prioritySpace => {
    //                 if (prioritySpace.priority.micro_location.city == city) {
    //                     return prioritySpace;
    //                 }
    //             }));
    //         }
    //         result.count = await WorkSpace.countDocuments(condition);
    //         return result;
    //     } catch (error) {
    //         throw (error);
    //     }
    // }
    async getPriorityWorkSpaces({ type, city, virtual_priority = false }) {
        try {
            const dynamicPriorityBase = manageWorkSpaceService._createDynamicPriorityType(type, virtual_priority);

            if (!dynamicPriorityBase) {
                return { prioritySpaces: [], count: 0 };
            }

            const priorityIsActiveField = `${dynamicPriorityBase}.is_active`;
            const priorityOrderField = `${dynamicPriorityBase}.order`;
            const cityFilterField = `${dynamicPriorityBase}.city`; // Correctly constructs the path to the city ID

            const condition = {
                [priorityIsActiveField]: true,
                slug: { $nin: blackListWS },
            };

            if (city && (type === 'location' || type === 'micro_location')) {
                condition[cityFilterField] = city;
            }

            const prioritySpaces = await WorkSpace.find(condition)
                .populate('location.city')
                .populate('location.micro_location')
                .populate('brand')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .sort({
                    [priorityOrderField]: 1 // Ascending sort
                })
            // .lean(); // Use .lean() for faster, read-only operations
            const count = await WorkSpace.countDocuments(condition);

            return { prioritySpaces, count };

        } catch (error) {
            console.error("Error in getPriorityWorkSpaces:", error);
            throw error;
        }
    }

    async getSimilarPlacesByLocation({ findKey, limit = 10, sortBy = 'name', orderBy, skip, }) {
        try {
            let result = {};
            let condition = { 'location.name': findKey, status: 'approve', slug: { $nin: blackListWS } };
            result.similarPlaces = await WorkSpace.find(condition)
                .populate('location.city')
                .populate('brand')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .limit(limit)
                .skip(skip)
                .sort({
                    [sortBy]: orderBy
                });
            result.count = await WorkSpace.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async getPopularPlacesByKey({
        key,
        limit = 10,
        skip,
        orderBy,
        sortType = 1,
        micro_location,
        city,
        minPrice = 0,
        maxPrice = 100000000,
        space_type,
        id: userId,
        locations
    }) {
        try {
            let result = {};
            let condition = {}
            let workspaces = []
            let parseLocations;
            if (locations) {
                parseLocations = JSON.parse(locations)
            }
            if (micro_location) {
                condition = { status: 'approve', slug: { $nin: blackListWS } };
                const pieces = key.split('-');
                let locationKey = '';
                for (let index = 0; index < pieces.length - 1; index++) {
                    locationKey += pieces[index].toLocaleLowerCase() + ' ';
                }
                locationKey = locationKey.trim();
                const name = { $regex: new RegExp('^\\s*' + locationKey.trim() + '\\s*$', 'i') };
                var microLocation = await MicroLocation.findOne({ name, city });
                if (microLocation) {
                    condition['location.micro_location'] = microLocation._id;
                }
                if (space_type) {
                    condition['plans'] = {
                        $elemMatch: {
                            'category': space_type,
                        }
                    };
                }
                if (minPrice && maxPrice) {
                    condition['plans'] = {
                        $elemMatch: {
                            'price': { $gte: +minPrice, $lte: +maxPrice },
                            'duration': 'month'
                        }
                    };
                }
                if (parseLocations && Array.isArray(parseLocations)) {
                    const objectIdLocations = parseLocations
                        .map((id) => parseObjectIdParam(id))
                        .filter(Boolean);
                    if (objectIdLocations.length > 0) {
                        condition['location.micro_location'] = { $in: objectIdLocations };
                    }
                }
                if (minPrice && maxPrice && space_type) {
                    condition['plans'] = {
                        $elemMatch: {
                            'price': { $gte: +minPrice, $lte: +maxPrice },
                            'duration': 'month',
                            'category': space_type,
                        }
                    };
                }
                workspaces = await WorkSpace.find(condition)
                    .populate('images.image')
                    .populate('location.micro_location')
                    .populate({
                        path: 'brand',
                        populate: {
                            path: 'image',
                        },
                    })
                    .populate('location.city')
                    // .select('name images location priority brand plans slug space_contact_details spaceTag ratings country_dbname status currency_code')
                    // .limit(limit)
                    // .skip(skip)
                    .sort({
                        ['priority.micro_location.order']: sortType
                    });
            }
            // const map = _.head(response.data.results);
            // const { lat, lng } = map.geometry.location;
            // const lat = map.lat;
            // const lng = map.lon;
            const lat = microLocation?.latitude;
            const lng = microLocation?.longitude;
            let workSpacesByCoordinates = await WorkSpace.aggregate([{
                $geoNear: {
                    near: { type: "Point", coordinates: [+lng, +lat] },
                    distanceField: "distance",
                    maxDistance: 10 * 1000, // IN KM,
                    spherical: true
                },
            },
            {
                $match: {
                    $and: [
                        { status: 'approve' },
                        { plans: { $elemMatch: { 'price': { $gte: +minPrice, $lte: +maxPrice } } } },
                        { slug: { $nin: blackListWS } },
                        // { 'location.city': city },
                    ]
                }
            },
            // { $project: { name: 1, images: 1, location: 1, distance: 1, brand: 1 , plans: 1, slug: 1, space_contact_details: 1, spaceTag: 1, ratings: 1, country_dbname: 1, status: 1, currency_code: 1} },
            { $addFields: { 'id': '$_id' } },
            { $sort: { distance: orderBy } },
            {
                $facet: {
                    metadata: [{ $count: "count" }],
                    result: [{ $skip: skip }, { $limit: limit }]
                }
            }
            ]);
            const sanitizeResponse = await this._sanitizeApiResponse(workSpacesByCoordinates);
            await workspaces.forEach((ws, index) => {
                sanitizeResponse.workSpaces.splice(index, 0, ws);
            })
            if (sanitizeResponse.workSpaces.length > 20) {
                sanitizeResponse.workSpaces.length = 20;
            }
            workspaces = [...workspaces, ...sanitizeResponse.workSpaces];
            // if (workspaces.length > 20) {
            //     workspaces.length = 20;
            // }
            if (micro_location) {
                const uniqueWorkspaces = workspaces.filter(
                    (workspace, index, self) =>
                        index === self.findIndex((w) => w.id === workspace.id)
                );
                result.workSpaces = uniqueWorkspaces
                // await this._checkUserFavorite(workspaces, userId, minPrice, maxPrice);
                result.count = uniqueWorkspaces.length;
            }
            if (!micro_location) {
                result.workSpaces = sanitizeResponse.workSpaces;
                result.count = sanitizeResponse.count;
            }
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async _sanitizeApiResponse(workSpaces) {
        let result = {};
        let ws = _.head(workSpaces)
        await WorkSpace.populate(ws.result, { path: 'images.image' });
        await WorkSpace.populate(ws.result, { path: 'brand' });
        await WorkSpace.populate(ws.result, { path: 'location.city' });
        await WorkSpace.populate(ws.result, { path: 'location.micro_location' });
        await WorkSpace.populate(ws.result, { path: 'location.country' });
        result.workSpaces = ws.result;
        result.count = ws.metadata.length && ws.metadata[0].count || 0;
        return result;
    }

    _checkUserFavorite(workSpaces, userId, minPrice, maxPrice) {
        let workSpacesWithFavorite = []
        workSpaces.forEach(space => {
            space = space.toObject();
            if (userId) {
                const is_favorite = space.likes.find(x => x == userId)
                space.is_favorite = is_favorite ? true : false;
            }
            const plans = space.plans.filter(plan => {
                return plan.price >= +minPrice && plan.price <= +maxPrice
            });
            space.plans = plans;
            workSpacesWithFavorite.push(Object.assign({}, space));
        });
        return workSpacesWithFavorite;
    }

    _throwException(message) {
        throw ({
            name: "cofynd",
            code: 404,
            message
        })
    }
}

export default new ManageWorkSpaceService();