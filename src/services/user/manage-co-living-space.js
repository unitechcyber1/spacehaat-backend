import models from '../../models/index.js';
import axios from 'axios';
import app from '../../config/app.js';
import { ObjectId } from 'mongodb';
import _ from 'lodash';
import manageWorkSpaceService from '../admin/manage-work-space.js';
const CoLivingSpace = models['CoLivingSpace'];
const MicroLocation = models['MicroLocation'];

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
const blackListWS = []
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
    enterprise_availability: 1,
    sleepimg: 1,

}

class ManageCoLivingSpaceService {
    constructor() {
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };
        return {
            getCoLivingSpaces: this.getCoLivingSpaces.bind(this),
            getCoLivingSpaceById: this.getCoLivingSpaceById.bind(this),
            getPriorityCoLivingSpaces: this.getPriorityCoLivingSpaces.bind(this),
            getPriorityCoLivingSpaces1: this.getPriorityCoLivingSpaces1.bind(this),
            // getPopularCoLivingSpaces: this.getPopularCoLivingSpaces.bind(this),
            // getSimilarPlacesByLocation: this.getSimilarPlacesByLocation.bind(this),
            getPopularPlacesByKey: this.getPopularPlacesByKey.bind(this),
            getPopularColivingSpacesCountryWise: this.getPopularColivingSpacesCountryWise.bind(this),
            getNearBySpaces: this.getNearBySpaces.bind(this)
        }
    }

    async getCoLivingSpaces({
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
        id: userId,
        food,
        twinsharing,
        privaterooom,
        room_type,
    }) {
        try {
            let condition = { status: 'approve' };
            let result = {};
            let coLivingSpaces = null;
            if (latitude && longitude) {
                const result = await this._getCoLivingSpacesByDistnace(longitude, latitude, minPrice, maxPrice, limit, skip, orderBy);
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
            if (city) {
                condition['location.city'] = city;
                sortBy = manageWorkSpaceService._createDynamicPriorityType('location') + '.order';
            }
            if (amenties) {
                amenties = amenties.split(',');
                condition['amenties'] = { '$in': amenties };
            }

            if (food) {
                condition['other_detail.food_and_beverage'] = food
            }
            if (twinsharing) {
                condition['coliving_plans.planId'] = twinsharing
            }
            if (privaterooom) {
                condition['coliving_plans.planId'] = privaterooom
            }
            if (room_type) {
                condition['coliving_plans.planId'] = room_type
            }
            if (minPrice && maxPrice) {
                // condition['price.single_sharing'] = { $gte: +minPrice, $lte: +maxPrice };
                condition['coliving_plans.price'] = { $gte: +minPrice, $lte: +maxPrice };
            }
            if (minPrice && maxPrice && room_type) {
                condition['coliving_plans'] = {
                    $elemMatch: {
                        'price': { $gte: +minPrice, $lte: +maxPrice },
                        'planId': room_type
                    }
                };
            }
            coLivingSpaces = await CoLivingSpace.find(condition)
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .populate('location.city')
                .populate('location.micro_location')
                .populate('amenties')
                .populate({
                    path: 'brand',
                    populate: {
                        path: 'image',
                    },
                })
                .limit(limit)
                .skip(skip)
                .sort({
                    [sortBy]: sortType
                });
            const toalCoLivingSpaces = await CoLivingSpace.find(condition);
            result.count = toalCoLivingSpaces.length;
            result.coLivingSpaces = this._checkUserFavorite(coLivingSpaces, userId);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async getCoLivingSpaceById({ findKey, id: userId }) {
        try {
            let condition = null;
            if (findKey.match(/^[0-9a-fA-F]{24}$/)) {
                condition = { _id: findKey } // Yes, it's a valid ObjectId, proceed with `findById` call.
            } else {
                condition = { slug: findKey }
            }
            condition['status'] = 'approve';
            let coLivingSpace = await CoLivingSpace.findOne(condition)
                .populate('amenties')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('location.city')
                .populate('location.micro_location')
                .populate('seo.open_graph.image')
                .populate('coliving_plans.planId')
                .populate('sleepimg')
                .populate({
                    path: 'brand',
                    populate: {
                        path: 'image',
                    },
                })
                .populate({
                    path: 'brand',
                    populate: {
                        path: 'images',
                        populate: {
                            path: 'image',
                        },
                    },
                })
                .exec().then(async (user) => {
                    const data = await CoLivingSpace.populate(user, 'coliving_plans.planId.icons')
                    return data
                })
            if (!coLivingSpace) {
                this._throwException('Not Found');
            }
            let is_favorite = coLivingSpace.likes && coLivingSpace.likes.find(x => x == userId);
            is_favorite = is_favorite ? true : false;
            return Object.assign({}, coLivingSpace.toObject(), { is_favorite });
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
    async getNearBySpaces ({lat, long, slug, microlocation,  limit = 20, page = 1, city}) {
    try {
       let condition = {}
       let result = {};
      if(slug){
        const livspace = await CoLivingSpace.findOne({ slug })
        if (!livspace) {
          return res.status(404).send("Coliving not found");
        }
        let spaces = await CoLivingSpace.find({
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
          if(microlocation){
            const name = { $regex: `^${microlocation}$`, $options: "i" };
            const location = await MicroLocation.findOne({name: name, city: city})
            if(location){
                condition['location.micro_location'] = {
                    $in: [location?._id]
                };
            }
            condition['status'] = "approve"
            var locationSpace = await CoLivingSpace.find(condition)
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
        let spaces =await CoLivingSpace.find({
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
            if(microlocation){
                const name = { $regex: `^${microlocation}$`, $options: "i" };
                const location = await MicroLocation.findOne({name, city})
                if(location){
                    condition['location.micro_location'] = {
                        $in: [location?._id]
                    };
                }
                condition['status'] = "approve"
                var locationSpace = await CoLivingSpace.find(condition)
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
    async getPopularPlacesByKey({
        key,
        minPrice = 0,
        maxPrice = 1000000,
        limit = 10,
        sortType = 1,
        skip,
        type,
        orderBy,
        micro_location,
        city,
        food,
        twinsharing,
        privaterooom,
        id: userId,
    }) {
        try {
            let colivingSpaces = [];
            let result = {}
            // const query = `https://maps.googleapis.com/maps/api/geocode/json?address=${key}&region=IN&key=${app.googleApiKey}`
            // const query = `https://us1.locationiq.com/v1/search.php?key=${app.locationIqApiKey}&q=${key}&format=json`
            // const query = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(key)}`
            // const response = await axios.get(query);
            // if (!response) {
            //     this._throwException('google api response issue');
            // }
            const priorityTypeOrder = manageWorkSpaceService._createDynamicPriorityType(type) + '.order';
            if (micro_location) {
                let condition = { status: 'approve' };
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
                if (minPrice && maxPrice) {
                    condition['coliving_plans'] = {
                        $elemMatch: {
                            'price': { $gte: +minPrice, $lte: +maxPrice }
                        }
                    };
                }
                if (food) {
                    condition['other_detail.food_and_beverage'] = food
                }
                if (twinsharing) {
                    condition['coliving_plans.planId'] = twinsharing
                }
                if (privaterooom) {
                    condition['coliving_plans.planId'] = privaterooom
                }
                if (city) {
                    condition['location.city'] = city
                }
                var colivingSpaces1 = await CoLivingSpace.find(condition)
                    .populate('images.image')
                    .populate('seo.twitter.image')
                    .populate('seo.open_graph.image')
                    .populate('brand')
                    .populate('location.city')
                    .populate('location.micro_location')
                    .populate({
                        path: 'brand',
                        populate: {
                            path: 'image',
                        },
                    })
                // .limit(limit)
                // .skip(skip)
                // .sort({
                //     ['priority.micro_location.order']: sortType
                // });
                colivingSpaces1.sort((a, b) => {
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
            //     return { coLivingSpaces: [], count: 0 };
            // }
            // const { lat, lng } = map.geometry.location;
            const lat = microLocation?.latitude;
            const lng = microLocation?.longitude;
            let coLivingSpaces = await CoLivingSpace.aggregate([{
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
                        { coliving_plans: { $elemMatch: { 'price': { $gte: +minPrice, $lte: +maxPrice } } } },
                        // { 'location.city': city },
                    ]
                }
            },
            { $addFields: { 'id': '$_id' } },
            {
                $lookup: {
                    from: 'brands', // Replace with the actual name of your 'brand' collection
                    localField: 'brand', // The field in your 'CoLivingSpace' collection that holds the reference
                    foreignField: '_id', // The field in the 'brand' collection to match against
                    as: 'brandData', // Alias for the joined data
                },
            },
            {
                $unwind: '$brandData', // Unwind the array created by the $lookup stage
            },
            {
                $lookup: {
                    from: 'images', // Replace with the actual name of your 'image' collection
                    localField: 'brandData.image', // The field in the 'brand' collection that holds the reference to 'image'
                    foreignField: '_id', // The field in the 'image' collection to match against
                    as: 'brandData.imageData', // Alias for the joined 'image' data
                },
            },
            {
                $unwind: '$brandData.imageData', // Unwind the 'imageData' array created by the $lookup stage
            },
            { $sort: { distance: orderBy } },
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

            const sanitizeResponse = await this._sanitizeApiResponse(coLivingSpaces);
            colivingSpaces.forEach((ws, index) => {
                const isExits = sanitizeResponse.coLivingSpaces.some(col => {
                    return String(col._id) === String(ws._id)
                });
                if (!isExits) {
                    sanitizeResponse.coLivingSpaces.splice(index, 0, ws);
                }
            })
            if (sanitizeResponse.coLivingSpaces.length > 20) {
                sanitizeResponse.coLivingSpaces.length = 20;
            }
            if ((colivingSpaces1 && colivingSpaces1.length > 0) && sanitizeResponse.coLivingSpaces.length > 0) {
                var arr = colivingSpaces1.concat(sanitizeResponse.coLivingSpaces)
            } else {
                if ((colivingSpaces1 && colivingSpaces1.length) > sanitizeResponse.coLivingSpaces.length) {
                    return colivingSpaces1;
                } else {
                    return sanitizeResponse.coLivingSpaces;
                }
            }
            return arr;
        } catch (error) {
            throw (error);
        }
    }
    // async getPopularPlacesByKey({
    //     key,
    //     minPrice = 0,
    //     maxPrice = 1000000,
    //     limit = 10,
    //     sortType = 1,
    //     skip,
    //     type,
    //     orderBy,
    //     micro_location,
    //     city,
    //     food,
    //     twinsharing,
    //     privaterooom,
    //     id: userId,
    // }) {
    //     try {
    //         let colivingSpaces = [];
    //         let result = {}
    //         // const query = `https://maps.googleapis.com/maps/api/geocode/json?address=${key}&region=IN&key=${app.googleApiKey}`
    //         // const query = `https://us1.locationiq.com/v1/search.php?key=${app.locationIqApiKey}&q=${key}&format=json`
    //         // const query = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(key)}`
    //         // const response = await axios.get(query);
    //         // if (!response) {
    //         //     this._throwException('google api response issue');
    //         // }
    //         const priorityTypeOrder = manageWorkSpaceService._createDynamicPriorityType(type) + '.order';
    //         if(key){
    //             console.log(key)
    //             let condition = {}
    //             const regex = { $regex: key, $options: "i" };
    //             condition['location.address'] = regex;
    //             condition["status"] = "approve";   
    //         var space = await CoLivingSpace.find(condition)
    //         console.log(space[0]?.location?.latitude, space[0]?.location?.longitude)
    //         }
    //         if (space[0]?.location?.micro_location[0]) {
    //             let condition = { status: 'approve' };
    //             // const pieces = key.split('-');
    //             // let locationKey = '';
    //             // for (let index = 0; index < pieces.length - 1; index++) {
    //             //     locationKey += pieces[index].toLocaleLowerCase() + ' ';
    //             // }
    //             // locationKey = locationKey.trim();
    //             // const name = { $regex: new RegExp('^\\s*' + locationKey.trim() + '\\s*$', 'i') };
    //             const microlocation = await MicroLocation.findOne({ _id: space[0]?.location?.micro_location[0] });
    //             console.log(microlocation)
    //             if (microlocation) {
    //                 condition['location.micro_location'] = {
    //                     $in: [microlocation._id]
    //                 };
    //             }
    //             if (minPrice && maxPrice) {
    //                 condition['coliving_plans'] = {
    //                     $elemMatch: {
    //                         'price': { $gte: +minPrice, $lte: +maxPrice }
    //                     }
    //                 };
    //             }
    //             if (food) {
    //                 condition['other_detail.food_and_beverage'] = food
    //             }
    //             if (twinsharing) {
    //                 condition['coliving_plans.planId'] = twinsharing
    //             }
    //             if (privaterooom) {
    //                 condition['coliving_plans.planId'] = privaterooom
    //             }
    //             if (city) {
    //                 condition['location.city'] = city
    //             }
    //             var colivingSpaces1 = await CoLivingSpace.find(condition)
    //                 .populate('images.image')
    //                 .populate('seo.twitter.image')
    //                 .populate('seo.open_graph.image')
    //                 .populate('brand')
    //                 .populate('location.city')
    //                 .populate({
    //                     path: 'brand',
    //                     populate: {
    //                         path: 'image',
    //                     },
    //                 })
    //             // .limit(limit)
    //             // .skip(skip)
    //             // .sort({
    //             //     ['priority.micro_location.order']: sortType
    //             // });
    //             colivingSpaces1.sort((a, b) => {
    //                 const priorityA = a.priority_loc && a.priority_loc.find(
    //                     (priority) =>
    //                         priority.microlocationId && priority.microlocationId.toString() === microlocation?.id
    //                 );
    //                 const priorityB = b.priority_loc && b.priority_loc.find(
    //                     (priority) =>
    //                         priority.microlocationId && priority.microlocationId.toString() === microlocation?.id
    //                 );
    //                 if (priorityA && priorityB) {
    //                     return priorityA.order - priorityB.order;
    //                 } else if (priorityA) {
    //                     return -1; // Move a to a lower index
    //                 } else if (priorityB) {
    //                     return 1; // Move b to a lower index
    //                 } else {
    //                     return 0; // No change in order if both are undefined
    //                 }
    //             });
    //             console.log(colivingSpaces1.length)
    //         }
    //         // const map = _.head(response.data.results);
    //         // const map = _.head(response.data);
    //         // if (!map) {
    //         //     return { coLivingSpaces: [], count: 0 };
    //         // }
    //         // const { lat, lng } = map.geometry.location;
    //         if(space){
    //             const lat = space[0]?.location?.latitude;
    //             const lng = space[0]?.location?.longitude;
    //             var coLivingSpaces = await CoLivingSpace.aggregate([{
    //                 $geoNear: {
    //                     near: { type: "Point", coordinates: [+lng, +lat] },
    //                     distanceField: "distance",
    //                     maxDistance: 5 * 1000, // IN KM,
    //                     spherical: true
    //                 },
    //             },
    //             {
    //                 $match: {
    //                     $and: [
    //                         { status: 'approve' },
    //                         { coliving_plans: { $elemMatch: { 'price': { $gte: +minPrice, $lte: +maxPrice } } } },
    //                         // { 'location.city': city },
    //                     ]
    //                 }
    //             },
    //             { $addFields: { 'id': '$_id' } },
    //             {
    //                 $lookup: {
    //                     from: 'brands', // Replace with the actual name of your 'brand' collection
    //                     localField: 'brand', // The field in your 'CoLivingSpace' collection that holds the reference
    //                     foreignField: '_id', // The field in the 'brand' collection to match against
    //                     as: 'brandData', // Alias for the joined data
    //                 },
    //             },
    //             {
    //                 $unwind: '$brandData', // Unwind the array created by the $lookup stage
    //             },
    //             {
    //                 $lookup: {
    //                     from: 'images', // Replace with the actual name of your 'image' collection
    //                     localField: 'brandData.image', // The field in the 'brand' collection that holds the reference to 'image'
    //                     foreignField: '_id', // The field in the 'image' collection to match against
    //                     as: 'brandData.imageData', // Alias for the joined 'image' data
    //                 },
    //             },
    //             {
    //                 $unwind: '$brandData.imageData', // Unwind the 'imageData' array created by the $lookup stage
    //             },
    //             { $sort: { distance: orderBy } },
    //             {
    //                 $facet: {
    //                     metadata: [{ $count: "count" }],
    //                     result: [
    //                         { $skip: skip },
    //                         { $limit: limit }
    //                     ]
    //                 }
    //             }
    //             ]);
    //         }

    //         const sanitizeResponse = await this._sanitizeApiResponse(coLivingSpaces);
    //         colivingSpaces.forEach((ws, index) => {
    //             const isExits = sanitizeResponse.coLivingSpaces.some(col => {
    //                 return String(col._id) === String(ws._id)
    //             });
    //             if (!isExits) {
    //                 sanitizeResponse.coLivingSpaces.splice(index, 0, ws);
    //             }
    //         })
    //         if (sanitizeResponse.coLivingSpaces.length > 20) {
    //             sanitizeResponse.coLivingSpaces.length = 20;
    //         }
    //         if ((colivingSpaces1 && colivingSpaces1.length > 0) && sanitizeResponse.coLivingSpaces.length > 0) {
    //             var arr = colivingSpaces1.concat(sanitizeResponse.coLivingSpaces)
    //         } else {
    //             if ((colivingSpaces1 && colivingSpaces1.length) > sanitizeResponse.coLivingSpaces.length) {
    //                 return colivingSpaces1;
    //             } else {
    //                 return sanitizeResponse.coLivingSpaces;
    //             }
    //         }
    //         return arr;
    //     } catch (error) {
    //         throw (error);
    //     }
    // }

    // //radius in meters means radius around the given lat lng ie delhi circle by default
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

    async getPriorityCoLivingSpaces({ type, city }) {
        try {
            let result = {};
            const priorityType = manageWorkSpaceService._createDynamicPriorityType(type) + '.is_active';
            const priorityTypeOrder = manageWorkSpaceService._createDynamicPriorityType(type) + '.order';
            let condition = {
                [priorityType]: true
            };
            result.prioritySpaces = await CoLivingSpace.find(condition)
                .populate('location.city')
                .populate("location.micro_location", "name")
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
            result.count = await CoLivingSpace.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async getPriorityCoLivingSpaces1({ key, type, city }) {
        try {
            let result = {};
            const priorityType = manageWorkSpaceService._createDynamicPriorityType(type) + '.is_active';
            const priorityTypeOrder = manageWorkSpaceService._createDynamicPriorityType(type) + '.order';
            let condition = {
                [priorityType]: true
            };

            const pieces = key.split('-');
            let locationKey = '';
            for (let index = 0; index < pieces.length - 1; index++) {
                locationKey += pieces[index].toLocaleLowerCase() + ' ';
            }
            const name = { $regex: new RegExp('^\\s*' + locationKey.trim() + '\\s*$', 'i') };
            const microLocation = await MicroLocation.findOne({ name, city });
            if (microLocation) {
                condition['location.micro_location'] = microLocation._id;
            }
            result.prioritySpaces = await CoLivingSpace.find(condition)
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
            result.count = await CoLivingSpace.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async getPopularColivingSpacesCountryWise({ countryId }) {
        try {
            let result = {};
            let condition = { 'is_popular.value': true, 'location.country': countryId, slug: { $nin: blackListWS } };
            result.popularSpaces = await CoLivingSpace.find(condition)
                .populate('location.city')
                .populate('brand')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .sort({ 'is_popular.order': 1 });
            result.count = await CoLivingSpace.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async _getCoLivingSpacesByDistnace(longitude, latitude, minPrice, maxPrice, limit, skip, orderBy, sortKey = 'micro_location', sortType = -1) {
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
        let coLivingSpace = await CoLivingSpace.aggregate([{
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
        return await this._sanitizeApiResponse(coLivingSpace);
    }

    _checkUserFavorite(coLivingSpaces, userId) {
        let coLivingSpacesWithFavorite = []
        coLivingSpaces.forEach(space => {
            space = space.toObject();
            const is_favorite = space.likes.find(x => x == userId)
            space.is_favorite = is_favorite ? true : false;
            space.amenties = space.amenties.map(amenty => {
                return { name: amenty.name, is_available: true }
            });
            coLivingSpacesWithFavorite.push(Object.assign({}, space));
        });
        return coLivingSpacesWithFavorite;
    }

    async _sanitizeApiResponse(coLivingSpaces) {
        let result = {};
        let ws = _.head(coLivingSpaces)
        await CoLivingSpace.populate(ws.result, { path: 'images.image' });
        await CoLivingSpace.populate(ws.result, { path: 'brand' });
        await CoLivingSpace.populate(ws.result, { path: 'location.city' });
        await CoLivingSpace.populate(ws.result, { path: 'location.micro_location' });
        await CoLivingSpace.populate(ws.result, { path: 'location.country' });
        result.coLivingSpaces = ws.result;
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

export default new ManageCoLivingSpaceService();