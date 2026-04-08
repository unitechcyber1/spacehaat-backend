import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

const StateSchema = new Schema({
    name: { type: String, required: true },
    description: String,
    country: {
        type: Schema.Types.ObjectId,
        ref: 'Country',
        required: true
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
    }
},
    mongoSchemaOptions
);

StateSchema.index({ "name": 1, "country": 1 }, { unique: true })

export default StateSchema;
