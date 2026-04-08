import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';


const WorkSpaceSchema = new Schema({
    name: { type: String, required: true },
    description: String,
    currency_code: String,
    country_dbname: String,
    email: String,
    ratings: String,
    spaceTag: String,
    contact_details: [{
        designation: String,
        name: String,
        phone_number: String
    }],
    space_contact_details: {
        name: String,
        email: String,
        phone: String,
        show_on_website: Boolean,
    },
    website_Url: String,
    images: [{
        image: {
            type: Schema.Types.ObjectId,
            ref: 'Image'
        },
        order: Number
    }],
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
    virtualSeo: {
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
    location: {
        name: String,
        name1: String,
        floor: String,
        address1: String,
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

    hours_of_operation: {
        monday: {
            from: String,
            to: String,
            should_show: {
                type: Boolean,
                default: true
            },
            is_closed: {
                type: Boolean,
                default: false
            },
            is_open_24: {
                type: Boolean,
                default: false
            }
        },
        tuesday: {
            from: String,
            to: String,
            should_show: {
                type: Boolean,
                default: false
            },
            is_closed: {
                type: Boolean,
                default: false
            },
            is_open_24: {
                type: Boolean,
                default: false
            }
        },
        wednesday: {
            from: String,
            to: String,
            should_show: {
                type: Boolean,
                default: false
            },
            is_closed: {
                type: Boolean,
                default: false
            },
            is_open_24: {
                type: Boolean,
                default: false
            }
        },
        thursday: {
            from: String,
            to: String,
            should_show: {
                type: Boolean,
                default: false
            },
            is_closed: {
                type: Boolean,
                default: false
            },
            is_open_24: {
                type: Boolean,
                default: false
            }
        },
        friday: {
            from: String,
            to: String,
            should_show: {
                type: Boolean,
                default: false
            },
            is_closed: {
                type: Boolean,
                default: false
            },
            is_open_24: {
                type: Boolean,
                default: false
            }
        },
        saturday: {
            from: String,
            to: String,
            should_show: {
                type: Boolean,
                default: false
            },
            is_closed: {
                type: Boolean,
                default: false
            },
            is_open_24: {
                type: Boolean,
                default: false
            }
        },
        sunday: {
            from: String,
            to: String,
            should_show: {
                type: Boolean,
                default: false
            },
            is_closed: {
                type: Boolean,
                default: false
            },
            is_open_24: {
                type: Boolean,
                default: false
            }
        }
    },
    rooms: [{
        room: {
            type: Schema.Types.ObjectId,
            ref: 'Room'
        },
        data: [{
            name: { type: String, required: true },
            open_space: { type: Boolean, default: false },
            description: String,
            capacity: Number,
            equipments: [String],
            /** TODO will add as a reference later with Equipment model */
            time_period: Number,
            price: Number,
            duration: {
                type: String,
                enum: ['month', 'year', 'week', 'day', 'hour'],
                default: 'hour'
            }
        }]
    }],
    no_of_seats: Number,
    plans: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: 'Category'
        },
        image: {
            type: Schema.Types.ObjectId,
            ref: 'Image'
        },
        duration: {
            type: String,
            enum: ['month', 'year', 'week', 'day', 'hour'],
            default: 'hour'
        },
        time_period: Number,
        price: Number,
        number_of_items: {
            type: Number,
            default: 1
        },
        should_show: {
            type: Boolean,
            default: true
        }
    }],
    calendar: [{
        date: {
            type: Date,
            required: true
        },
        seats: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ['available', 'unavailable'],
            required: true
        }
    }],
    likes: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
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
    brand: {
        type: Schema.Types.ObjectId,
        ref: 'Brand'
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
    virtual_priority: {
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
    productId: { type: String, default: '' },
    small_team_availability: { type: Boolean, default: false },
    enterprise_availability: { type: Boolean, default: false },
    added_by_user: {
        type: String,
        enum: ['seller', 'admin'],
        default: 'admin'
    },
    space_type_key: { type: String }
},
    mongoSchemaOptions
)

WorkSpaceSchema.virtual('space_type').get(function () {
    return "coworking";
});
WorkSpaceSchema.index({ geometry: "2dsphere" });
WorkSpaceSchema.index({ "name": 'text', "location.address1": 1 }, { unique: true })
WorkSpaceSchema.index({ 'location.city': 1 });
export default WorkSpaceSchema;