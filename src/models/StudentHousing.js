import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';


const StudentHousingSpaceSchema = new Schema({
    name: { type: String, required: true },
    description: String,
    slug: String,
    likes: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    location: {
        name: String,
        floor: String,
        address: String,
        city: {
            type: Schema.Types.ObjectId,
            ref: 'City'
        },
        micro_location: {
            type: Schema.Types.ObjectId,
            ref: 'MicroLocation'
        },
        state: String,
        country: String,
        postal_code: String,
        landmark: String,
        landmark_distance: String,
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
    price: {
        single_sharing: { type: Number, default: 0 },
        double_sharing: { type: Number, default: 0 },
        triple_sharing: { type: Number, default: 0 },
        studio_apartment: { type: Number, default: 0 }
    },
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
        enum: ['pending', 'approve', 'reject'],
        default: 'pending'
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
},
    mongoSchemaOptions
)

StudentHousingSpaceSchema.virtual('space_type').get(function () {
    return "co-living";
});
StudentHousingSpaceSchema.index({ geometry: "2dsphere" });
StudentHousingSpaceSchema.index({ "name": 1, "location.address": 1 }, { unique: true })


export default StudentHousingSpaceSchema;