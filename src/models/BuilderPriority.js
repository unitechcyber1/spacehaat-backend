import { Schema } from 'mongoose';
import { mongoSchemaOptions } from '../utilities/constants.js';

const BuilderPrioritySchema = new Schema({
        builder: {
            type: Schema.Types.ObjectId,
            ref: 'Builder'
        },
        city: {
            type: Schema.Types.ObjectId,
            ref: 'City'
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


export default BuilderPrioritySchema;