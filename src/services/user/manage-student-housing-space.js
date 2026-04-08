import models from '../../models/index.js';
import axios from 'axios';
import app from '../../config/app.js';
import _ from 'lodash';
import manageWorkSpaceService from '../admin/manage-work-space.js';
const StudentHousing = models['StudentHousing'];
const MicroLocation = models['MicroLocation'];
const filteredFields = {
    name: 1,
    description: 1,
    images: 1,
    amenties: 1,
    social_media: 1,
    seo: 1,
    location: 1,
    hours_of_operation: 1,
    geometry: 1,
    likes: 1,
    is_active: 1,
    status: 1,
    slug: 1,
    priority: 1,
    is_popular: 1,
}

class ManageStudentHousingService {
    constructor() {
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };
        return {
            getStudentHousings: this.getStudentHousings.bind(this),
            getStudentHousingById: this.getStudentHousingById.bind(this),
            getPriorityStudentHousings: this.getPriorityStudentHousings.bind(this),
            // getPopularStudentHousings: this.getPopularStudentHousings.bind(this),
            // getSimilarPlacesByLocation: this.getSimilarPlacesByLocation.bind(this),
            getPopularPlacesByKey: this.getPopularPlacesByKey.bind(this)
        }
    }

    async getStudentHousings({
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
            let StudentHousings = null;
            if (latitude && longitude) {
                const result = await this._getStudentHousingsByDistnace(longitude, latitude, minPrice, maxPrice, limit, skip, orderBy);
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
            if (name && (name != 'Colive' || name != 'colive' || name != 'live' || name != 'Live' || name != 'col' || name != 'Col')) {
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
                condition['price.single_sharing'] = { $gte: +minPrice, $lte: +maxPrice };
            }
            StudentHousings = await StudentHousing.find(condition)
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .populate('location.city')
                .populate('amenties')
                .limit(limit)
                .skip(skip)
                .sort({
                    [sortBy]: sortType });
            const toalStudentHousings = await StudentHousing.find(condition);
            result.count = toalStudentHousings.length;
            result.StudentHousings = this._checkUserFavorite(StudentHousings, userId);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async getStudentHousingById({ findKey, id: userId }) {
        try {
            let condition = null;
            if (findKey.match(/^[0-9a-fA-F]{24}$/)) {
                condition = { _id: findKey } // Yes, it's a valid ObjectId, proceed with `findById` call.
            } else {
                condition = { slug: findKey }
            }
            condition['status'] = 'approve';
            let StudentHousing = await StudentHousing.findOne(condition)
                .populate('amenties')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image');
            if (!StudentHousing) {
                this._throwException('Not Found');
            }
            let is_favorite = StudentHousing.likes && StudentHousing.likes.find(x => x == userId);
            is_favorite = is_favorite ? true : false;
            return Object.assign({}, StudentHousing.toObject(), { is_favorite });
        } catch (error) {
            throw error;
        }
    }

    // async getPopularOfficeSpaces() {
    //     try {
    //         let result = {};
    //         let condition = { 'is_popular.value': true };
    //         result.popularSpaces = await OfficeSpace.find(condition)
    //             .populate('location.city')
    //             .populate('images.image')
    //             .populate('seo.twitter.image')
    //             .populate('seo.open_graph.image')
    //             .sort({ 'is_popular.order': 1 });
    //         result.count = await OfficeSpace.countDocuments(condition);
    //         return result;
    //     } catch (error) {
    //         throw (error);
    //     }
    // }


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
            let StudentHousings = [];
            const query = `https://maps.googleapis.com/maps/api/geocode/json?address=${key}&region=IN&key=${app.googleApiKey}`
            const response = await axios.get(query);
            if (!response) {
                this._throwException('google api response issue');
            }
            if (micro_location) {
                let condition = { status: 'approve' };
                condition['name'] = { '$not': /Colive/ };
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
                StudentHousings = await StudentHousing.find(condition)
                    .populate('images.image')
                    .populate('seo.twitter.image')
                    .populate('seo.open_graph.image')
                    .populate('brand')
                    .populate('location.city')
                    .limit(limit)
                    .skip(skip)
                    .sort({
                        ['priority.micro_location.order']: sortType });
            }
            const map = _.head(response.data.results);
            if (!map) {
                return { StudentHousings: [], count: 0 };
            }
            const { lat, lng } = map.geometry.location;
            let StudentHousings1 = await StudentHousing.aggregate([{
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
            const sanitizeResponse = await this._sanitizeApiResponse(StudentHousings1);
            StudentHousings1.forEach((ws, index) => {
                const isExits = sanitizeResponse.StudentHousings1.some(col => {
                    return String(col._id) === String(ws._id)
                });
                if (!isExits) {
                    sanitizeResponse.StudentHousings1.splice(index, 0, ws);
                }
            })
            if (sanitizeResponse.StudentHousings1.length > 20) {
                sanitizeResponse.StudentHousings1.length = 20;
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

    async getPriorityStudentHousings({ type, city }) {
        try {
            let result = {};
            const priorityType = manageWorkSpaceService._createDynamicPriorityType(type) + '.is_active';
            const priorityTypeOrder = manageWorkSpaceService._createDynamicPriorityType(type) + '.order';
            let condition = {
                [priorityType]: true };
            result.prioritySpaces = await StudentHousing.find(condition)
                .populate('location.city')
                .populate('brand')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .sort({
                    [priorityTypeOrder]: 1 });
            if (type === 'location') {
                result.prioritySpaces = _.compact(result.prioritySpaces.map(prioritySpace => {
                    if (prioritySpace.priority.location.city == city) {
                        return prioritySpace;
                    }
                }));
            }
            result.count = await StudentHousing.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async _getStudentHousingsByDistnace(longitude, latitude, minPrice, maxPrice, limit, skip, orderBy) {
        let StudentHousing = await StudentHousing.aggregate([{
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
                        { price: { $elemMatch: { 'single_sharing': { $gte: +minPrice, $lte: +maxPrice } } } },
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
        return await this._sanitizeApiResponse(StudentHousing);
    }

    _checkUserFavorite(StudentHousings, userId) {
        let StudentHousingsWithFavorite = []
        StudentHousings.forEach(space => {
            space = space.toObject();
            const is_favorite = space.likes.find(x => x == userId)
            space.is_favorite = is_favorite ? true : false;
            space.amenties = space.amenties.map(amenty => {
                return { name: amenty.name, is_available: true }
            });
            StudentHousingsWithFavorite.push(Object.assign({}, space));
        });
        return StudentHousingsWithFavorite;
    }

    async _sanitizeApiResponse(StudentHousings) {
        let result = {};
        let ws = _.head(StudentHousings)
        await StudentHousing.populate(ws.result, { path: 'images.image' });
        await StudentHousing.populate(ws.result, { path: 'location.city' });
        result.StudentHousings = ws.result;
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

export default new ManageStudentHousingService();