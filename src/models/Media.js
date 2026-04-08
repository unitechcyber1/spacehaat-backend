import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

const MediaSchema = new Schema({
        name: { type: String, unique: true, required: true },
        image: {
            type: Schema.Types.ObjectId,
            ref: 'Image',
            required: false
        },
        description: String,
        active: {
            type: Boolean,
            default: true
        },
        createdAt: { type: Date, default: Date.now },
    },
    mongoSchemaOptions
);
MediaSchema.index({ "name": 1, "description": 1 }, { unique: true })

export default MediaSchema;