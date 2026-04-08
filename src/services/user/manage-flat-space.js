import models from '../../models/index.js';
import axios from 'axios';
import app from '../../config/app.js';
import _ from 'lodash';
import manageWorkSpaceService from '../admin/manage-work-space.js';
import manageFlatSpaceService from '../admin/manage-flat-space.js';
import { ObjectId } from 'mongodb';
const Flats= models['Flats'];
const MicroLocation = models['MicroLocation'];
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
    // const filteredFields = {
    //     name: 1,
    //     description: 1,
    //     images: 1,
    //     amenties: 1,
    //     social_media: 1,
    //     seo: 1,
    //     location: 1,
    //     hours_of_operation: 1,
    //     geometry: 1,
    //     likes: 1,
    //     is_active: 1,
    //     status: 1,
    //     slug: 1,
    //     priority: 1,
    //     is_popular: 1,
    //     coliving_plans:1,
    // }
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
    coliving_plans: 1,
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

class ManageFlatSpaceService {
    constructor() {
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };
        return {
            getFlatSpaces: this.getFlatSpaces.bind(this),
            getFlatSpaceById: this.getFlatSpaceById.bind(this),
            getPriorityFlatSpaces: this.getPriorityFlatSpaces.bind(this),
            getPopularflatSpaces: this.getPopularflatSpaces.bind(this),
            getPopularFlatSpaces: this.getPopularFlatSpaces.bind(this),
            // getSimilarPlacesByLocation: this.getSimilarPlacesByLocation.bind(this),
            getPopularPlacesByKey: this.getPopularPlacesByKey.bind(this),
            getPopularFlatSpacesCountryWise: this.getPopularFlatSpacesCountryWise.bind(this)
        }
    }

    async getFlatSpaces({
        limit = 10,
        sortBy = 'priority',
        sortType = 1,
        orderBy,
        skip,
        slug,
        amenties,
        minPrice = 0,
        maxPrice = 100000,
        city,
        latitude,
        longitude,
        is_near_metro,
        is_sunday_open,
        is_open_24,
        name,
        id: userId
    }) {
        try {
            let condition = { status: 'approve' };
            let result = {};
            let FlatSpaces = null;
            if (latitude && longitude) {
                const result = await this._getFlatSpacesByDistnace(longitude, latitude, minPrice, maxPrice, limit, skip, orderBy);
                return result;
            }
            if (is_sunday_open) {
                is_sunday_open = (is_sunday_open.toLowerCase() == 'true');
                condition['hours_of_operation.is_sunday_open'] = is_sunday_open;
            }
            if (is_open_24) {
                is_open_24 = (is_open_24.toLowerCase() == 'true');
                condition['hours_of_operation.is_open_24'] = is_open_24;
            }
            if (is_near_metro) {
                is_near_metro = (is_near_metro.toLowerCase() == 'true');
                condition['location.metro_detail.is_near_metro'] = is_near_metro;
            }
            if (slug) {
                condition['slug'] = slug;
            }
            if (name && (name != 'Colive' || name != 'colive' || name != 'live')) {
                const googleResults = await this.getSpaceByLocation(name);
                name = '.*' + name + '.*';
                condition['name'] = { $regex: new RegExp('^' + name + '$', 'i') };
                result.googleResults = googleResults;
            } else {
                condition['name'] = { '$not': /Colive/ };
            }
            if (city) {
                condition['location.city'] = city;
                sortBy = manageWorkSpaceService._createDynamicPriorityType('location') + '.order';
            }
            if (amenties) {
                amenties = amenties.split(',');
                condition['amenties'] = { '$in': amenties };
            }
            if (minPrice && maxPrice) {
                // condition['price.single_sharing'] = { $gte: +minPrice, $lte: +maxPrice };
                condition['coliving_plans.price'] = { $gte: +minPrice, $lte: +maxPrice };
            }

            FlatSpaces = await Flats.find(condition)
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .populate('location.city')
                .populate('amenties')
                .limit(limit)
                .skip(skip)
                .sort({
                    [sortBy]: sortType
                });
            const toalFlatSpaces = await Flats.find(condition);
            result.count = toalFlatSpaces.length;
            result.FlatSpaces = this._checkUserFavorite(FlatSpaces, userId);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async getFlatSpaceById({ findKey, id: userId }) {
        try {
            let condition = null;
            if (findKey.match(/^[0-9a-fA-F]{24}$/)) {
                condition = { _id: findKey } // Yes, it's a valid ObjectId, proceed with `findById` call.
            } else {
                condition = { slug: findKey }
            }
            condition['status'] = 'approve';
            let FlatSpace = await Flats.findOne(condition)
                .populate('amenties')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .populate('coliving_plans.planId')
                .exec().then(async(user) => {
                    const data = await Flats.populate(user, 'coliving_plans.planId.icons')
                    return data
                })
            if (!FlatSpace) {
                this._throwException('Not Found');
            }
            let is_favorite = FlatSpace.likes && FlatSpace.likes.find(x => x == userId);
            is_favorite = is_favorite ? true : false;
            return Object.assign({}, FlatSpace.toObject(), { is_favorite });
        } catch (error) {
            throw error;
        }
    }
    async getPopularflatSpaces() {
        try {
            let result = {};
            let condition = { 'is_popular.value': true, slug: { $nin: blackListWS } };
            result.popularSpaces = await Flats.find(condition)
                .populate('location.city')
                .populate('brand')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .sort({ 'is_popular.order': 1 });
            result.count = await Flats.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }
    async getPopularFlatSpaces() {
        try {
            let result = {};
            let condition = { 'is_popular.value': true };
            result.popularSpaces = await Flats.find(condition)
                .populate('location.city')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .sort({ 'is_popular.order': 1 });
            result.count = await Flats.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }


    // async getSimilarPlacesByLocation({ findKey, limit = 10, sortBy = 'name', orderBy, skip, }) {
    //     try {
    //         let result = {};
    //         let condition = { 'location.name': findKey, status: 'approve' };
    //         result.similarPlaces = await OfficeSpace.find(condition)
    //             .populate('location.city')
    //             .populate('images.image')
    //             .populate('seo.twitter.image')
    //             .populate('seo.open_graph.image')
    //             .limit(limit)
    //             .skip(skip)
    //             .sort({ [sortBy]: orderBy });
    //         result.count = await OfficeSpace.countDocuments(condition);
    //         return result;
    //     } catch (error) {
    //         throw (error);
    //     }
    // }

    async getPopularPlacesByKey({ key, minPrice = 0, maxPrice = 1000000, limit = 10, sortType = 1, skip, orderBy, micro_location, city }) {
        try {
            let FlatSpaces = [];
            const query = `https://maps.googleapis.com/maps/api/geocode/json?address=${key}&region=IN&key=${app.googleApiKey}`
            const response = await axios.get(query);
            if (!response) {
                this._throwException('google api response issue');
            }
            if (micro_location) {
                let condition = { status: 'approve' };
                const pieces = key.split('-');
                let locationKey = '';
                for (let index = 0; index < pieces.length - 1; index++) {
                    locationKey += pieces[index].toLocaleLowerCase() + ' ';
                }
                const name = { $regex: new RegExp('^' + locationKey.trim() + '$', 'i') }
                const microLocation = await MicroLocation.findOne({ name, city });
                if (microLocation) {
                    condition['location.micro_location'] = microLocation._id;
                }
                if (minPrice && maxPrice) {
                    condition['plans'] = {
                        $elemMatch: {
                            'price': { $gte: +minPrice, $lte: +maxPrice }
                        }
                    };
                }
                FlatSpaces = await Flats.find(condition)
                    .populate('images.image')
                    .populate('seo.twitter.image')
                    .populate('seo.open_graph.image')
                    .populate('brand')
                    .populate('location.city')
                    .limit(limit)
                    .skip(skip)
                    .sort({
                        ['priority.micro_location.order']: sortType
                    });
            }
            const map = _.head(response.data.results);
            if (!map) {
                return { FlatSpaces: [], count: 0 };
            }
            const { lat, lng } = map.geometry.location;
            let FLatSpaces = await Flats.aggregate([{
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
                            { 'price.single_sharing': { $gte: +minPrice, $lte: +maxPrice } },
                        ]
                    }
                },
                { $addFields: { 'id': '$_id' } },
                { $sort: { distance: orderBy } },
                {
                    $facet: {
                        metadata: [{ $count: "count" }],
                        result: [{ $skip: skip }, { $limit: limit }]
                    }
                }
            ]);
            const sanitizeResponse = await this._sanitizeApiResponse(FLatSpaces);
            FlatSpaces.forEach((ws, index) => {
                const isExits = sanitizeResponse.FlatSpaces.some(col => {
                    return String(col._id) === String(ws._id)
                });
                if (!isExits) {
                    sanitizeResponse.FlatSpaces.splice(index, 0, ws);
                }
            })
            if (sanitizeResponse.FlatSpaces.length > 20) {
                sanitizeResponse.FlatSpaces.length = 20;
            }
            return sanitizeResponse;
        } catch (error) {
            throw (error);
        }
    }

    // //radius in meters means radius around the given lat lng ie delhi circle by default
    async getSpaceByLocation(name, locationBias = { radius: 50000, lat: 28.4457, lng: 77.0824 }) {
        try {
            const query = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${name}&language=en&location=${locationBias.lat},${locationBias.lng}&radius=${locationBias.radius}&strictbounds&region=IN&key=${app.googleApiKey}`
            const results = await axios.get(query);
            return results.data.predictions.map(r => {
                return {
                    address: r.description,
                    placeId: r.place_id,
                    name: r.terms[0].value
                }
            });
        } catch (e) {
            throw (e)
        }
    }

    async getPriorityFlatSpaces({ type, city }) {
        try {
            let result = {};
            const priorityType = manageWorkSpaceService._createDynamicPriorityType(type) + '.is_active';
            const priorityTypeOrder = manageWorkSpaceService._createDynamicPriorityType(type) + '.order';
            let condition = {
                [priorityType]: true
            };
            result.prioritySpaces = await Flats.find(condition)
                .populate('location.city')
                .populate('brand')
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
            result.count = await Flats.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async getPopularFlatSpacesCountryWise({ countryId }) {
        try {
            let result = {};
            let condition = { 'is_popular.value': true, 'location.country': countryId, slug: { $nin: blackListWS } };
            result.popularSpaces = await Flats.find(condition)
                .populate('location.city')
                .populate('brand')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .sort({ 'is_popular.order': 1 });
            result.count = await Flats.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async _getFlatSpacesByDistnace(longitude, latitude, minPrice, maxPrice, limit, skip, orderBy, sortKey = 'micro_location', sortType = -1) {
        let filters = Object.assign({}, filteredFields, {
            coliving_plans: {
                $filter: {
                    input: "$coliving_plans",
                    as: "coliving_plans",
                    cond: {
                        $and: [
                            { $gte: ["$$coliving_plans.price", +minPrice] },
                            { $lte: ["$$coliving_plans.price", +maxPrice] }
                        ]
                    }
                }
            }
        })
        let FlatSpace = await Flats.aggregate([{
                $geoNear: {
                    near: { type: "Point", coordinates: [+longitude, +latitude] },
                    distanceField: "distance",
                    maxDistance: 10 * 1000, // IN KM,
                    spherical: true
                },
            },
            {
                $match: {
                    $and: [
                        { status: 'approve' },
                        { coliving_plans: { $elemMatch: { 'price': { $gte: +minPrice, $lte: +maxPrice } } } }
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
        return await this._sanitizeApiResponse(FlatSpace);
    }

    _checkUserFavorite(FlatSpaces, userId) {
        let FlatSpacesWithFavorite = []
        FlatSpaces.forEach(space => {
            space = space.toObject();
            const is_favorite = space.likes.find(x => x == userId)
            space.is_favorite = is_favorite ? true : false;
            space.amenties = space.amenties.map(amenty => {
                return { name: amenty.name, is_available: true }
            });
            FlatSpacesWithFavorite.push(Object.assign({}, space));
        });
        return FlatSpacesWithFavorite;
    }

    async _sanitizeApiResponse(FlatSpaces) {
        let result = {};
        let ws = _.head(FlatSpaces)
        await Flats.populate(ws.result, { path: 'images.image' });
        await Flats.populate(ws.result, { path: 'brand' });
        await Flats.populate(ws.result, { path: 'location.city' });
        await Flats.populate(ws.result, { path: 'location.country' });
        result.Flatss = ws.result;
        result.count = ws.metadata.length && ws.metadata[0].count || 0;
        return result;
    }

    _throwException(message) {
        throw ({
            name: "cofynd",
            code: 404,
            message
        })
    }
}

export default new ManageFlatSpaceService();