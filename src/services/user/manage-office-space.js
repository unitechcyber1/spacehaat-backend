import models from '../../models/index.js';
import axios from 'axios';
import app from '../../config/app.js';
import _ from 'lodash';
import manageWorkSpaceService from '../admin/manage-work-space.js';
import { ObjectId } from 'mongodb';
const OfficeSpace = models['OfficeSpace'];
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

class ManageOfficeSpaceService {
    constructor() {
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };
        return {
            getOfficeSpaces: this.getOfficeSpaces.bind(this),
            getOfficeSpaceById: this.getOfficeSpaceById.bind(this),
            getPopularOfficeSpaces: this.getPopularOfficeSpaces.bind(this),
            getSimilarPlacesByLocation: this.getSimilarPlacesByLocation.bind(this),
            getPopularPlacesByKey: this.getPopularPlacesByKey.bind(this),
            getPriorityOfficeSpaces: this.getPriorityOfficeSpaces.bind(this),
            getNearBySpaces: this.getNearBySpaces.bind(this)
        }
    }

    async getOfficeSpaces({
        limit = 10,
        sortBy = 'priority',
        sortType = 1,
        orderBy,
        skip,
        slug,
        amenties,
        maxPrice,
        minPrice,
        minSize,
        maxSize,
        officeType,
        min_rent_in_sq_ft,
        max_rent_in_sq_ft,
        city,
        micro_location,
        latitude,
        location,
        longitude,
        is_near_metro,
        is_sunday_open,
        is_open_24,
        name,
        id: userId,
        building_name
    }) {
        try {
            let condition = { status: 'approve' };
            let result = {};
            let officeSpaces = null;
            if (latitude && longitude) {
                const result = await this._getOfficeSpacesByDistnace(longitude, latitude, limit, skip, orderBy, minPrice, maxPrice, minSize, maxSize, officeType);
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
            if (minSize && maxSize) {
                condition['other_detail.area_for_lease_in_sq_ft'] = { $lte: maxSize, $gte: minSize };
            }
            if (min_rent_in_sq_ft && max_rent_in_sq_ft) {
                condition['other_detail.rent_in_sq_ft'] = { $lte: min_rent_in_sq_ft, $gte: max_rent_in_sq_ft };
            }
            if (maxPrice && minPrice) {
                const result = await this._getOfficeSpacesByDistnace(longitude, latitude, limit, skip, orderBy, minPrice, maxPrice, minSize, maxSize, officeType, city);
                return result;
            }
            if (officeType && officeType !== 'all') {
                condition['other_detail.office_type'] = officeType;
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
            if (building_name) {
                condition['other_detail.building_name'] = building_name;
            }
            if (location) {
                if (city) {
                    condition['location.city'] = city
                }
                location = location.replace(/[^A-Za-z0-9 ]/g, "");
                let regexPattern = location.split('').join('[\\s-]*') + '[\\s-]*';
                const microLocation = await MicroLocation.findOne({ name: {  '$regex': `^(\s+${regexPattern}|^${regexPattern})`, '$options': 'i' }, city: city});
                condition['location.micro_location'] = microLocation._id
            }
            officeSpaces = await OfficeSpace.find(condition)
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .populate('location.city')
                .populate('location.micro_location')
                .populate('amenties')
                .limit(limit)
                .skip(skip)
                .sort({
                    [sortBy]: sortType
                });
            const toalOfficeSpaces = await OfficeSpace.find(condition);
            result.count = toalOfficeSpaces.length;
            result.officeSpaces = this._checkUserFavorite(officeSpaces, userId);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async getOfficeSpaceById({ findKey, id: userId }) {
        try {
            let condition = null;
            if (findKey.match(/^[0-9a-fA-F]{24}$/)) {
                condition = { _id: findKey } // Yes, it's a valid ObjectId, proceed with `findById` call.
            } else {
                condition = { slug: findKey }
            }
            condition['status'] = 'approve';
            let officeSpace = await OfficeSpace.findOne(condition)
                .populate('amenties')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('location.city')
                .populate('location.micro_location')
                .populate('seo.open_graph.image')
                .populate('building')
                .populate('builder')
                .populate({
                    path: 'builder',
                    populate: { path: 'builder_logo', model: 'Image' },
                })
                .exec();
            if (!officeSpace) {
                this._throwException('Not Found');
            }
            let is_favorite = officeSpace.likes && officeSpace.likes.find(x => x == userId);
            is_favorite = is_favorite ? true : false;
            return Object.assign({}, officeSpace.toObject(), { is_favorite });
        } catch (error) {
            throw error;
        }
    }

    async getPopularOfficeSpaces() {
        try {
            let result = {};
            let condition = { 'is_popular.value': true };
            result.popularSpaces = await OfficeSpace.find(condition)
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .populate('location.city')
                .populate('location.micro_location')
                .sort({ 'is_popular.order': 1 });
            result.count = await OfficeSpace.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async getSimilarPlacesByLocation({ findKey, limit = 10, sortBy = 'name', orderBy, skip, }) {
        try {
            let result = {};
            let condition = { 'location.name': findKey, status: 'approve' };
            result.similarPlaces = await OfficeSpace.find(condition)
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('location.city')
                .populate('location.micro_location')
                .populate('seo.open_graph.image')
                .limit(limit)
                .skip(skip)
                .sort({
                    [sortBy]: orderBy
                });
            result.count = await OfficeSpace.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async getMatchConditionWithMicrolocation(minPrice, maxPrice, minSize, maxSize, officeType, micro_location, key, city) {
        let condition = [{ status: 'approve' }];
        let microLocation;
        if (micro_location) {
            const pieces = key.split('-');
            let locationKey = '';
            for (let index = 0; index < pieces.length - 1; index++) {
                locationKey += pieces[index].toLocaleLowerCase() + ' ';
            }
            locationKey = locationKey.trim();
            const name = { $regex: new RegExp('^\\s*' + locationKey.trim() + '\\s*$', 'i') };
             microLocation = await MicroLocation.findOne({ name, city });
            if (microLocation) {
                condition.push({'location.micro_location' : microLocation._id});
            }
            // if(city) {
            //     condition.push({'location.city' : city});
            // }
        }
        if (minSize && maxSize) {
            condition.push({
                'other_detail.area_for_lease_in_sq_ft': { $lte: Number(maxSize), $gte: Number(minSize) }
            });
        }
        if (officeType && officeType !== 'all') {
            condition.push({ 'other_detail.office_type': officeType });
        }
        if (minPrice && maxPrice) {
            condition.push({ 'total_score': { $lte: Number(maxPrice), $gte: Number(minPrice) } });
        }
        return { cond: {$and: condition}, locationId: microLocation._id }
    }

    async removeExtraSpaces(str) {
        return str.replace(/\s+/g, ' ').trim();
      }

    getMatchCondition(minPrice, maxPrice, minSize, maxSize, officeType) {
        let condition = [{ status: 'approve' }];
        if (minSize && maxSize) {
            condition.push({
                'other_detail.area_for_lease_in_sq_ft': { $lte: Number(maxSize), $gte: Number(minSize) }
            });
        }
        if (officeType && officeType !== 'all') {
            condition.push({ 'other_detail.office_type': officeType });
        }
        if (minPrice && maxPrice) {
            condition.push({ 'total_score': { $lte: Number(maxPrice), $gte: Number(minPrice) } });
        }
        return { $and: condition }
    }
    async getNearBySpaces ({lat, long, slug, microlocation,  limit = 20, page = 1}) {
        try {
           let condition = {}
           let result = {};
          if(slug){
            const livspace = await OfficeSpace.findOne({ slug })
            if (!livspace) {
              return res.status(404).send("OfficeSpace not found");
            }
            let spaces = await OfficeSpace.find({
                _id: { $ne: livspace._id },
                "status": "approve",
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
              .populate('location.city')
              if(microlocation){
                const name = { $regex: `^${microlocation}$`, $options: "i" };
                const location = await MicroLocation.findOne({name})
                if(location){
                    condition['location.micro_location'] = {
                        $in: [location?._id]
                    };
                }
                condition['status'] = "approve"
                var locationSpace = await OfficeSpace.find(condition)
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .populate('location.city')
              }
             if(locationSpace){
                spaces = locationSpace.concat(spaces)
             }
                 result.spaces = spaces;
                 result.totalRecords = spaces.length
                return result
          }
          if(lat && long){
            const latitude = parseFloat(lat)
            const longitude = parseFloat(long)
            let spaces =await OfficeSpace.find({
                "status": "approve",
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
              .populate('location.city')

                if(microlocation){
                    const name = { $regex: `^${microlocation}$`, $options: "i" };
                    const location = await MicroLocation.findOne({name})
                    if(location){
                        condition['location.micro_location'] = {
                            $in: [location?._id]
                        };
                    }
                    condition['status'] = "approve"
                    var locationSpace = await OfficeSpace.find(condition)
                    .populate('images.image')
                    .populate('seo.twitter.image')
                    .populate('seo.open_graph.image')
                    .populate('location.city')
                  }
                 if(locationSpace){
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
 //radius in meters means radius around the given lat lng ie delhi circle by default
 async getPopularPlacesByKey({
    key, limit = 10, skip, orderBy, type, minPrice, maxPrice, minSize, maxSize, officeType, micro_location, city, location
}) {
    try {
        let colivingSpaces = [];
        let condition = {}
        // const query = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(key)}`
        // const response = await axios.get(query);
        // if (!response) {
        //     this._throwException('google api response issue');
        // }
        const priorityTypeOrder = manageWorkSpaceService._createDynamicPriorityType(type) + '.order';
        if (location) {
            if (city) {
                condition['location.city'] = city
            }
            location = location.replace(/[^A-Za-z0-9 ]/g, "");
            let regexPattern = location.split('').join('[\\s-]*') + '[\\s-]*';
            var microLocation = await MicroLocation.findOne({ name: {  '$regex': `^(\s+${regexPattern}|^${regexPattern})`, '$options': 'i' }, city});
            condition['location.micro_location'] = microLocation._id
            var officeSpaces1 = await OfficeSpace.find(condition)
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .populate('location.city')
                .populate('location.micro_location')
                return officeSpaces1
        }
        if (micro_location) {
             condition['status'] = "approve"
            const pieces = key.split('-');
            let locationKey = '';
            for (let index = 0; index < pieces.length - 1; index++) {
                locationKey += pieces[index].toLocaleLowerCase() + ' ';
            }
            locationKey = locationKey.trim();
            const name = { $regex: new RegExp('^\\s*' + locationKey.trim() + '\\s*$', 'i') };
            var microLocation = await MicroLocation.findOne({ name, city });
            if (microLocation) {
                condition['location.micro_location'] = {
                    $in: [microLocation._id]
                };
            }
            if (officeType && officeType !== 'all') {
                condition['other_detail.office_type'] = officeType;
            }
            if (city) {
                condition['location.city'] = city
            }
            var officeSpaces1 = await OfficeSpace.find(condition)
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .populate('location.city')
                .populate('location.micro_location')
            officeSpaces1.sort((a, b) => {
                const priorityA = a.priority_loc && a.priority_loc.find(
                    (priority) =>
                        priority.microlocationId && priority.microlocationId.toString() === microLocation.id
                );
                const priorityB = b.priority_loc && b.priority_loc.find(
                    (priority) =>
                        priority.microlocationId && priority.microlocationId.toString() === microLocation.id
                );
                if (priorityA && priorityB) {
                    return priorityA.order - priorityB.order;
                } else if (priorityA) {
                    return -1; // Move a to a lower index
                } else if (priorityB) {
                    return 1; // Move b to a lower index
                } else {
                    return 0; // No change in order if both are undefined
                }
            });
        }
        // const map = _.head(response.data.results);
        // const map = _.head(response.data);
        // if (!map) {
        //     return { officeSpaces: [], count: 0 };
        // }
        // const { lat, lng } = map.geometry.location;
        // const lat = map.lat;
        // const lng = map.lon;
        const lat = microLocation?.latitude
        const lng = microLocation?.longitude;
        let officeSpaces = await OfficeSpace.aggregate([{
            $geoNear: {
                near: { type: "Point", coordinates: [+lng, +lat] },
                distanceField: "distance",
                maxDistance: 10 * 1000, // IN KM,
                spherical: true
            },
        },
        { $match: {status: 'approve'}},
        {
            $addFields: {
                'id': '$_id',
                'total_score': {
                    $multiply: [
                        "$other_detail.area_for_lease_in_sq_ft",
                        "$other_detail.rent_in_sq_ft"
                    ]
                }
            },
        },
        {
            $facet: {
                metadata: [{ $count: "count" }],
                result: [
                    { $skip: skip },
                    { $limit: limit }
                ]
            }
        }
        ]);

        const sanitizeResponse = await this._sanitizeApiResponse(officeSpaces);
        colivingSpaces.forEach((ws, index) => {
            const isExits = sanitizeResponse.officeSpaces.some(col => {
                return String(col._id) === String(ws._id)
            });
            if (!isExits) {
                sanitizeResponse.officeSpaces.splice(index, 0, ws);
            }
        })
        if((minPrice && maxPrice) || (minSize && maxSize)){
            const matchCondition = this.getMatchCondition(minPrice, maxPrice, minSize, maxSize, officeType);
            const officeSpaces1 = await this.queryRunForLatAndLong(lng, lat, matchCondition, limit, skip, orderBy, city);
            const sanitizeResponses = await this._sanitizeApiResponse(officeSpaces1);
            return sanitizeResponses.officeSpaces
         }
        if (sanitizeResponse.officeSpaces.length > 20) {
            sanitizeResponse.officeSpaces.length = 20;
        }
        if ((officeSpaces1 && officeSpaces1.length > 0) && sanitizeResponse.officeSpaces.length > 0) {
            var arr = officeSpaces1.concat(sanitizeResponse.officeSpaces)
        } 
        else {
            if ((officeSpaces1 && officeSpaces1.length) > sanitizeResponse.officeSpaces.length) {
                return officeSpaces1;
            } else {
                return sanitizeResponse.officeSpaces;
            }
        }
        return arr;
    } catch (error) {
        throw (error);
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

    async _getOfficeSpacesByDistnace(longitude, latitude, limit, skip, orderBy, minPrice, maxPrice, minSize, maxSize, officeType, city) {
        let officeSpaces = null;
        const matchCondition = this.getMatchCondition(minPrice, maxPrice, minSize, maxSize, officeType);
        if (longitude && latitude) {
            officeSpaces = await this.queryRunForLatAndLong(longitude, latitude, matchCondition, limit, skip, orderBy, city);
        } 
        else {
            officeSpaces = await this.queryForPriceFilter(matchCondition, limit, skip, orderBy, city);
        }
        return await this._sanitizeApiResponse(officeSpaces);
    }

    async queryForPriceFilter(matchCondition, limit, skip, orderBy, city) {
        return await OfficeSpace.aggregate([{
            $addFields: {
                'id': '$_id',
                'total_score': {
                    $multiply: [
                        "$other_detail.area_for_lease_in_sq_ft",
                        "$other_detail.rent_in_sq_ft"
                    ]
                }
            },
        },
        { $match: matchCondition },
        city ? { $match: { 'location.city': new ObjectId(city) } } : {},
        { $sort: { distance: orderBy } },
        {
            $facet: {
                metadata: [{ $count: "count" }],
                result: [{ $skip: skip }, { $limit: limit }]
            }
        }
        ]);
    }

    async queryRunForLatAndLong(longitude, latitude, matchCondition, limit, skip, orderBy, city) {
        let sortType = 1;
        const offices =  await OfficeSpace.aggregate([
            {
                $geoNear: {
                    near: { type: "Point", coordinates: [+longitude, +latitude] },
                    distanceField: "distance",
                    maxDistance: 10 * 1000, // IN KM,
                    spherical: true
                },
            },
            {
                $addFields: {
                    'id': '$_id',
                    'total_score': {
                        $multiply: [
                            "$other_detail.area_for_lease_in_sq_ft",
                            "$other_detail.rent_in_sq_ft"
                        ]
                    }
                },
            },
            { $match: matchCondition },
            city ? { $match: { 'location.city': new ObjectId(city) } } : {},
            // { $sort: { distance: orderBy } },
            // {
            //     $sort: {
            //         ['priority.micro_location.order']: sortType
            //     }
            // },
            {
                $facet: {
                    metadata: [{ $count: "count" }],
                    result: [{ $skip: skip }, { $limit: limit }]
                }
            }
        ]);
        return offices
    }

    async getPriorityOfficeSpaces({ type, city }) {
        try {
            let result = {};
            const priorityType = manageWorkSpaceService._createDynamicPriorityType(type) + '.is_active';
            const priorityTypeOrder = manageWorkSpaceService._createDynamicPriorityType(type) + '.order';
            let condition = {
                [priorityType]: true
            };
            result.prioritySpaces = await OfficeSpace.find(condition)
                .populate('location.city')
                .populate('location.micro_location')
                // .populate('brand')
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
            result.count = await OfficeSpace.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }

    _checkUserFavorite(officeSpaces, userId) {
        let officeSpacesWithFavorite = []
        officeSpaces.forEach(space => {
            space = space.toObject();
            const is_favorite = space.likes.find(x => x == userId)
            space.is_favorite = is_favorite ? true : false;
            space.amenties = space.amenties.map(amenty => {
                return { name: amenty.name, is_available: true }
            });
            officeSpacesWithFavorite.push(Object.assign({}, space));
        });
        return officeSpacesWithFavorite;
    }
    // async _sanitizeApiResponse(officeSpaces) {
    //     let result = {};
    //     let ws = _.head(officeSpaces)
    //     await OfficeSpace.populate(ws.result, { path: 'images.image' });
    //     await OfficeSpace.populate(ws.result, { path: 'location.city' });
    //     await OfficeSpace.populate(ws.result, { path: 'location.micro_location' });
    //     result.officeSpaces = ws.result;
    //     result.count = ws.metadata.length && ws.metadata[0].count || 0;
    //     return result;
    // }
    async _sanitizeApiResponse(officeSpaces) {
        let result = {};
        let ws = _.head(officeSpaces)
        await OfficeSpace.populate(ws.result, { path: 'images.image' });
        await OfficeSpace.populate(ws.result, { path: 'location.city' });
        await OfficeSpace.populate(ws.result, { path: 'location.micro_location' });
        result.officeSpaces = ws.result;
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

export default new ManageOfficeSpaceService();