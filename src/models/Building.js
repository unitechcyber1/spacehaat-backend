import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

/**
 * An office building that holds coworking centres and/or managed offices (e.g. "JMD Megapolis").
 * Centres point here through `building_id`; the website builds one page per building that has
 * 2 or more live centres (`/building/<slug>`).
 */
const BuildingSchema = new Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    city: { type: Schema.Types.ObjectId, ref: 'City' },
    micro_location: { type: Schema.Types.ObjectId, ref: 'MicroLocation' },
    address: { type: String, trim: true },
    latitude: Number,
    longitude: Number,
    /** Optional building photo (URL); without one the website shows a centre's photo. */
    image: { type: String, trim: true },
    description: String,
    is_active: { type: Boolean, default: true },
}, mongoSchemaOptions);

export default BuildingSchema;
