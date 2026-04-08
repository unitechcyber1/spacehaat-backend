import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

const CountrySchema = new Schema({
        name: { type: String, unique: true, required: true },
        image: {
            type: Schema.Types.ObjectId,
            ref: 'Image',
            required: false
        },
        dial_code: String,
        iso_code: String,
        description: String,
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
        for_queryform: {
            type: Boolean,
            default: false
        }
    },
    mongoSchemaOptions
);


export default CountrySchema;