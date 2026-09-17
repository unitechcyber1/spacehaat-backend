import mongoose from 'mongoose';
import { mongoSchemaOptions } from '../utilities/constants.js';

const { Schema } = mongoose;

const ClientBillingProfileSchema = new Schema({
    customerId: {
        type: Schema.Types.ObjectId,
        ref: 'Customer',
        required: true,
        unique: true,
        index: true,
    },
    billing_name: { type: String, required: true },
    billing_email: { type: String },
    billing_phone: { type: String },
    company_name: { type: String },
    gstin: { type: String },
    pan: { type: String },
    is_gst_registered: { type: Boolean, default: false },
    billing_address: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        state_code: String,
        pincode: String,
        country: { type: String, default: 'India' },
    },
    place_of_supply_state: { type: String },
    place_of_supply_state_code: { type: String },
}, mongoSchemaOptions);

export default ClientBillingProfileSchema;
