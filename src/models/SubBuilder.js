import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

const SubBuilderSchema = new Schema({
        builder: {
            type: Schema.Types.ObjectId,
            ref: 'Builder'
        },
        name: { type: String, required: true },
        description: String,
        isOfficeSpace: Boolean,
        isMoreCommercial: Boolean,
        isTopCommercial: Boolean,
        ratings: String,
        spaceTag: String,
        tagline: String, 
        overview: {
            configuration: String,
            build_up_area: String,
            project_type: {
                type: String,
                enum: ['residential', 'commercial', 'both'],
                default: 'residential'
            },
            project_size: String,
            apartment_design: String,
            is_sale: {
                type: Boolean,
                default: false
            },
            is_rent: {
                type: Boolean,
                default: false,
            },
            is_rera_approved: {
                type: Boolean,
                default: false,
            },
            is_zero_brokerage: {
                type: Boolean,
                default: false,
            }
        },
        amenties: [{
            type: Schema.Types.ObjectId,
            ref: 'Amenty'
        }],
        allAmenities: {
            commercial: [{
                type: Schema.Types.ObjectId,
                ref: 'Amenty'
            }],
            residential: [{
                type: Schema.Types.ObjectId,
                ref: 'Amenty'
            }],
        },
        plans: [{
            planId: {
                type: Schema.Types.ObjectId,
                ref: 'FlatPlans'
            },
            price: { type: String },
            area: { type: String },
            project_type: String,
            floor_plans: [{
                name: String,
                rent_price: { type: String },
                sale_price: { type: String },
                image: {
                    id: Schema.Types.ObjectId,
                    image: Schema.Types.ObjectId,
                    s3_link: String
                }
            }],
        }],
        currency_code: String,
        country_dbname: String,
        email: String,
        contact_details: [{
            designation: String,
            name: String,
            phone_number: String
        }],
        website_Url: String,
        images: [{
            image: {
                type: Schema.Types.ObjectId,
                ref: 'Image'
            },
            order: Number
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
        seo: {
            title: { type: String },
            description: { type: String },
            robots: String,
            keywords: String,
            url: String,
            footer_title: String,
            footer_description: String,
            script: String,
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
            near_by_places: [{
                lankmark: String,
                distance: String,
                image: {
                    id: Schema.Types.ObjectId,
                    image: Schema.Types.ObjectId,
                    s3_link: String
                }
            }],
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
        },
        geometry: {
            type: { type: String, default: 'Point' },
            coordinates: { type: [Number] }
        },
        is_active: {
            type: Boolean,
            default: true
        },
        status: {
            type: String,
            enum: ['pending', 'approve', 'reject'],
            default: 'pending'
        },
        slug: String,
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
            residential: {
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
            commercial: {
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
        },
        is_popular: {
            value: {
                type: Boolean,
                default: false
            },
            order: {
                type: Number
            }
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: '5f2ce468ecdb5a5d67f0c621'
        },
        createdAt: { type: Date, default: Date.now },
        expireAt: { type: Date, default: Date.now },
        added_by_user: {
            type: String,
            enum: ['seller', 'admin'],
            default: 'admin'
        },
    },
    mongoSchemaOptions
)

SubBuilderSchema.index({ "name": 'text', "location.address": 1 }, { unique: true })


export default SubBuilderSchema;