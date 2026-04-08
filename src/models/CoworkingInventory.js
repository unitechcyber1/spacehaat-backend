import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';


const CoworkingInventorySchema = new Schema({
    name: { type: String, required: true },
    description: String,
    contact_details: [{
        designation: String,
        name: String,
        email: String,
        phone_number: String
    }],
    space_type: String,
    location: {
        address: String,
        country: String,
        state: String,
        city: String,
        micro_location: String,
        landmark: String,
        landmark_distance: String,
        latitude: Number,
        longitude: Number,
        is_near_metro: {
            type: Boolean,
            default: false
        }
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
    no_of_seats: String,
    plans: [{
        category: String,
        seats: String,
        duration: {
            type: String,
        },
        price: Number,
    }],
    is_active: {
        type: Boolean,
        default: true
    },
    status: {
        type: String
    },
    brand: {
        type: Schema.Types.ObjectId,
        ref: 'Brand'
    },
    productId: { type: String, default: '' },
},
    mongoSchemaOptions
)

export default CoworkingInventorySchema;