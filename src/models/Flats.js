import { Schema } from 'mongoose';
import { mongoSchemaOptions } from '../utilities/constants.js';


const FlatsSpaceSchema = new Schema({
        name: { type: String, required: true },
        builder_name: { type: String },
        builder: {
            type: Schema.Types.ObjectId,
            ref: 'Builder'
        },
        subbuilder: {
            type: Schema.Types.ObjectId,
            ref: 'SubBuilder'
        },
        actual_propertyname: { type: String },
        description: String,
        currency_code: String,
        country_dbname: String,
        slug: String,
        likes: [{
            type: Schema.Types.ObjectId,
            ref: 'User'
        }],
        location: {
            name: String,
            floor: String,
            address: String,
            country: {
                type: Schema.Types.ObjectId,
                ref: 'Country'
            },
            state: {
                type: Schema.Types.ObjectId,
                ref: 'State'
            },
            city: {
                type: Schema.Types.ObjectId,
                ref: 'City'
            },
            micro_location: {
                type: Schema.Types.ObjectId,
                ref: 'MicroLocation'
            },
            micro_location_string: {
                type: String
            },
            postal_code: String,
            landmark: String,
            landmark_distance: String,
            metro_stop_landmark: String,
            ferry_stop_landmark: String,
            ferry_stop_distance: String,
            bus_stop_landmark: String,
            bus_stop_distance: String,
            taxi_stand_landmark: String,
            taxi_stand_distance: String,
            tram_landmark: String,
            tram_distance: String,
            hospital_landmark: String,
            hospital_distance: String,
            school_landmark: String,
            school_distance: String,
            restro_landmark: String,
            restro_distance: String,
            latitude: Number,
            longitude: Number,
            metro_detail: {
                name: String,
                is_near_metro: {
                    type: Boolean,
                    default: false
                },
                distance: Number
            },
            micro_location: {
                type: Schema.Types.ObjectId,
                ref: 'MicroLocation'
            },
            is_near_metro: {
                type: Boolean,
                default: false
            },
            is_ferry_stop: {
                type: Boolean,
                default: false
            },
            is_bus_stop: {
                type: Boolean,
                default: false
            },
            is_taxi_stand: {
                type: Boolean,
                default: false
            },
            is_tram: {
                type: Boolean,
                default: false
            },
            is_hospital: {
                type: Boolean,
                default: false
            },
            is_school: {
                type: Boolean,
                default: false
            },
            is_restro: {
                type: Boolean,
                default: false
            },
            shuttle_point: {
                name: String,
                is_near: {
                    type: Boolean,
                    default: false
                },
                distance: Number
            }
        },
        amenties: [{
            type: Schema.Types.ObjectId,
            ref: 'Amenty'
        }],
        social_media: {
            twitter: {
                type: String
            },
            facebook: {
                type: String
            },
            instagram: {
                type: String
            }
        },
        brand: {
            type: Schema.Types.ObjectId,
            ref: 'Brand'
        },
        seo: {
            title: { type: String },
            description: { type: String },
            robots: String,
            keywords: String,
            url: String,
            status: {
                type: Boolean,
                default: true
            },
            twitter: {
                title: String,
                description: String,
                image: {
                    type: Schema.Types.ObjectId,
                    ref: 'Image'
                }
            },
            open_graph: {
                title: String,
                description: String,
                image: {
                    type: Schema.Types.ObjectId,
                    ref: 'Image'
                }
            }
        },
        other_detail: {
            furnishing_type: {
                type: String
            },
            built_up_area: {
                type: String
            },
            carpet_area: {
                type: String
            },
            bathroom: {
                type: String
            },
            bedroom: {
                type: String
            },
            balcony: {
                type: String
            },
            floor: {
                type: String
            },
            total_floors: {
                type: String
            },
            preferred_tenants: {
                type: String
            },
            property_on_floor: {
                type: String
            },
            available_from: {
                type: String
            },
            monthly_maintenance1: {
                type: String
            },
            rent_negotiable: {
                type: String
            },
            security_deposit: {
                type: String
            },
            monthly_maintenance: {
                type: String
            },
            security_deposit_amount: {
                type: String
            },
            monthly_maintenance_amount: {
                type: String
            },
            breakfast: {
                is_include: {
                    type: Boolean,
                    default: false
                },
                price: { type: Number, default: 0 }
            },
            lunch: {
                is_include: {
                    type: Boolean,
                    default: false
                },
                price: { type: Number, default: 0 }
            },
            dinner: {
                is_include: {
                    type: Boolean,
                    default: false
                },
                price: { type: Number, default: 0 }
            },
            is_electricity_bill_included: {
                type: Boolean,
                default: false
            },
            beds: { type: Number, default: 1 },
            rent_per_bed: Number,
            deposit: Boolean,
            type_of_co_living: String,
            food_and_beverage: String
        },
        coliving_plans: [{
            planId: {
                type: Schema.Types.ObjectId,
                ref: 'FlatPlans'
            },
            price: { type: Number, default: 0 }
            // single_sharing: { type: Number, default: 0 },
            // double_sharing: { type: Number, default: 0 },
            // triple_sharing: { type: Number, default: 0 },
            // studio_apartment: { type: Number, default: 0 }
        }],
        geometry: {
            type: { type: String, default: 'Point' },
            coordinates: { type: [Number] }
        },
        images: [{
            image: {
                type: Schema.Types.ObjectId,
                ref: 'Image'
            },
            order: Number
        }],
        is_active: {
            type: Boolean,
            default: true
        },
        status: {
            type: String,
            enum: ['pending', 'approve', 'reject', 'inprogress'],
            default: 'pending'
        },
        assignedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        planStatus: { type: String },
        is_popular: {
            value: {
                type: Boolean,
                default: false
            },
            order: {
                type: Number
            }
        },
        priority: {
            overall: {
                is_active: {
                    type: Boolean,
                    default: false
                },
                order: {
                    type: Number,
                    default: 1000
                }
            },
            location: {
                city: {
                    type: Schema.Types.ObjectId,
                    ref: 'City'
                },
                is_active: {
                    type: Boolean,
                    default: false
                },
                order: {
                    type: Number,
                    default: 1000
                }
            },
            micro_location: {
                name: String,
                city: {
                    type: Schema.Types.ObjectId,
                    ref: 'City'
                },
                is_active: {
                    type: Boolean,
                    default: false
                },
                order: {
                    type: Number,
                    default: 1000
                }
            }
        },
        for_sale: {
            type: Boolean,
            default: false
        },
        for_rent: {
            type: Boolean,
            default: false
        },
        building_type: {
            type: String,
        },
        property_type: {
            type: String,
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: '5f2ce468ecdb5a5d67f0c621'
        },
        createdAt: { type: Date, default: Date.now },
        expireAt: { type: Date, default: Date.now },
        productId: { type: String, default: '' },
        added_by_user: {
            type: String,
            enum: ['seller', 'admin'],
            default: 'admin'
        },
        space_type_key: { type: String }
    },
    mongoSchemaOptions
)

FlatsSpaceSchema.virtual('space_type').get(function() {
    return "flats";
});


FlatsSpaceSchema.index({ geometry: "2dsphere" });
FlatsSpaceSchema.index({ "name": 1, "location.address": 1 }, { unique: true })

export default FlatsSpaceSchema;