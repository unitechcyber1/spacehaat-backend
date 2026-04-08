import { Schema } from 'mongoose';
import { mongoSchemaOptions } from '../utilities/constants.js';

const BuilderSchema = new Schema({
        name: { type: String, index: false, required: true },
        description: String,
        projects: String,
        establish_year: String,
        isCommercial: Boolean,
        isResidential: Boolean,
        ratings: String,
        spaceTag: String,
        builder_logo: {
            type: Schema.Types.ObjectId,
            ref: 'Image',
            required: false
        },
        overview: {
            starting_price: String,
            configuration: String,
            area: String,
            comercial_projects: String,
            residential_projects: String,
        },
        video_link: String,
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
            address: { type: String, index: false },
            country: {
                type: Schema.Types.ObjectId,
                ref: 'Country'
            },
            state: {
                type: Schema.Types.ObjectId,
                ref: 'State'
            },
            city: [{
                type: Schema.Types.ObjectId,
                ref: 'City'
            }],
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

// BuilderSchema.dropIndex({ "name": 1, "location.address": 1 }, { unique: true })


export default BuilderSchema;