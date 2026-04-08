import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

const AmentySchema = new Schema({
        category: {
            type: String,
            enum: ['facilities', 'recreational', 'others'],
            default: 'others'
        },
        name: { type: String, unique: true, required: true },
        icon: String,
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
        for_builder_project: {
            type: Boolean,
            default: false
        },
        priority: {
            for_coWorking: {
                order:{
                    type: Number,
                    default: 1000
                }
            },
            for_flatspace: {
                order:{
                    type: Number,
                    default: 1000
                }
            },
            for_office: {
                order:{
                    type: Number,
                    default: 1000
                }
            },
            for_coLiving: {
                order:{
                    type: Number,
                    default: 1000
                }
            },
        },
        createdAt: { type: Date, default: Date.now },
    },
    mongoSchemaOptions
);


export default AmentySchema;