import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

const BrandAdsSchema = new Schema({
        name: { type: String, unique: true, required: true },
        image: {
            type: Schema.Types.ObjectId,
            ref: 'Image',
            required: false
        },
        slug: String,
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
        for_flat: {
            type: Boolean,
            default: false
        },
        is_active: {
            type: Boolean,
            default: true
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
        is_popular: {
            value: {
                type: Boolean,
                default: false
            },
            order: {
                type: Number
            }
        },
    },
    mongoSchemaOptions
);
BrandAdsSchema.index({ "name": 1, "slug": 1 }, { unique: true })


export default BrandAdsSchema;