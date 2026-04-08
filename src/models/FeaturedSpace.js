import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

const CitySchema = new Schema({
        name: { type: String, unique: true, required: true },
        image: {
            type: Schema.Types.ObjectId,
            ref: 'Image',
            required: false
        },
        // icons: {
        //         type: Schema.Types.ObjectId,
        //         ref: 'Image',
        //     required: false },
        description: String,
        // country: {
        //     type: Schema.Types.ObjectId,
        //     ref: 'Country',
        //     required: true
        // },
        // state: {
        //     type: Schema.Types.ObjectId,
        //     ref: 'State',
        //     required: true
        // },
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
        }
    },
    mongoSchemaOptions
);
CitySchema.index({ "name": 1, "country": 1, "state": 1 }, { unique: true })


export default CitySchema;