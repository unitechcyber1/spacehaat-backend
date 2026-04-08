import { Schema } from 'mongoose';
import { mongoSchemaOptions } from '../utilities/constants.js';

// Minimal schema for VirtualOffice so that:
// - Reviews with on_model: 'VirtualOffice' can populate `space`
// - Existing VirtualOffice documents in MongoDB can be read
const VirtualOfficeSchema = new Schema({
    name: { type: String, required: true },
    description: String,
    slug: String,
    ratings: String
}, mongoSchemaOptions);

export default VirtualOfficeSchema;

