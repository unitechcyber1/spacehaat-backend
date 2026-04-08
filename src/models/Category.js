import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

const CategorySchema = new Schema({
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

CategorySchema.index({ "name": 1 }, { unique: true })

export default CategorySchema;