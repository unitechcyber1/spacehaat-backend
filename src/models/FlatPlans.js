import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

const FlatCategorySchema = new Schema({
        name: { type: String, required: true },
        country: { type: String, required: true },
        description: String,
        active: {
            type: Boolean,
            default: true
        },
        icons: {
            type: Schema.Types.ObjectId,
            ref: 'Image',
            required: false
        },
    },
    mongoSchemaOptions
);

FlatCategorySchema.index({ "name": 1 }, { unique: true })


export default FlatCategorySchema;