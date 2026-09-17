import mongoose from 'mongoose';
import { mongoSchemaOptions } from '../utilities/constants.js';

const { Schema } = mongoose;

/**
 * Standalone billing client — used for invoicing only.
 * Not linked to CRM Customer (deals/renewals).
 */
const BillingClientSchema = new Schema({
    billing_name: { type: String, required: true, trim: true },
    billing_email: { type: String, trim: true, index: true },
    billing_phone: { type: String, trim: true },
    company_name: { type: String, trim: true },
    gstin: { type: String, trim: true, sparse: true, index: true },
    pan: { type: String, trim: true },
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
    place_of_supply_state: { type: String, trim: true },
    place_of_supply_state_code: { type: String, trim: true },

    /** When true (default), invoice shows Bill To only. */
    ship_to_same_as_billing: { type: Boolean, default: true },
    ship_to_name: { type: String, trim: true },
    ship_to_company_name: { type: String, trim: true },
    ship_to_email: { type: String, trim: true },
    ship_to_phone: { type: String, trim: true },
    ship_to_gstin: { type: String, trim: true },
    shipping_address: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        state_code: String,
        pincode: String,
        country: { type: String, default: 'India' },
    },

    /** Default module when creating invoices for this client */
    default_space_type: {
        type: String,
        enum: ['Coworking Space', 'Office Space', 'PG', 'Coliving Space', 'Virtual Office'],
    },

    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active',
        index: true,
    },

    notes: String,
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
}, mongoSchemaOptions);

BillingClientSchema.index({ billing_name: 1 });
BillingClientSchema.index({ company_name: 1 });
BillingClientSchema.index({ status: 1, added_on: -1 });

export default BillingClientSchema;
