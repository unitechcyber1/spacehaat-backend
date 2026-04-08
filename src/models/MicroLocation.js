import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

const MircoLocationSchema = new Schema({
        name: { type: String, required: true },
        description: String,
        latitude: String,
        longitude: String,
        city: {
            type: Schema.Types.ObjectId,
            ref: 'City',
            required: true
        },
        locationImage: {
            coworking: {
               type: Schema.Types.ObjectId,
               ref: 'Image',
               required: false
            },
            coliving: {
               type: Schema.Types.ObjectId,
               ref: 'Image',
               required: false
            },
            officespace: {
               type: Schema.Types.ObjectId,
               ref: 'Image',
               required: false
            },
            virtualoffice: {
               type: Schema.Types.ObjectId,
               ref: 'Image',
               required: false
            },
            buildings: {
               type: Schema.Types.ObjectId,
               ref: 'Image',
               required: false
            }
           },
        active: {
            type: Boolean,
            default: true
        },
        for_coWorking: {
            type: Boolean,
            default: false
        },
        for_office: {
            type: Boolean,
            default: false
        },
        for_coLiving: {
            type: Boolean,
            default: false
        },
        for_flatspace: {
            type: Boolean,
            default: false
        },
        for_buildings: {
           type: Boolean,
           default: false
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
            for_coworking: {
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
            for_coliving: {
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
            for_office: {
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
            for_flat: {
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
            for_buildings: {
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
        }
    },
    mongoSchemaOptions
);

MircoLocationSchema.index({ "name": 1, "city": 1 }, { unique: true })

export default MircoLocationSchema;