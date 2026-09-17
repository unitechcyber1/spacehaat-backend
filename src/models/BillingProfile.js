import mongoose from 'mongoose';
import { mongoSchemaOptions } from '../utilities/constants.js';

const { Schema } = mongoose;

const StateBillingProfileSchema = new Schema({
    state_code: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    gstin: { type: String, required: true, trim: true },
    address: {
        line1: String,
        line2: String,
        city: String,
        pincode: String,
    },
    is_default: { type: Boolean, default: false },
}, { _id: true });

/** Cofynd global billing settings + per-state GST registrations */
const BillingProfileSchema = new Schema({
    key: { type: String, default: 'default', unique: true, index: true },
    legal_name: { type: String, required: true },
    trade_name: { type: String },
    /** Company PAN (same across states) */
    pan: { type: String },
    cin: { type: String },
    email: String,
    phone: String,
    website: { type: String },
    /** Default CC when sending invoices from admin */
    invoice_email_cc: [{ type: String }],
    /** Default BCC (internal copy) when sending invoices */
    invoice_email_bcc: [{ type: String }],
    invoice_reply_to: { type: String },
    bank_details: {
        account_name: String,
        account_number: String,
        ifsc: String,
        bank_name: String,
        address: {
            line1: String,
            line2: String,
            city: String,
            state: String,
            pincode: String,
        },
    },
    invoice_prefixes: {
        client_vo: { type: String, default: 'CF/VO' },
        client_cw: { type: String, default: 'CF/CW' },
        proforma_vo: { type: String, default: 'CF/PF/VO' },
        proforma_cw: { type: String, default: 'CF/PF/CW' },
        operator: { type: String, default: 'CF/OP' },
    },
    state_profiles: { type: [StateBillingProfileSchema], default: [] },
    default_payment_terms_days: { type: Number, default: 7 },
    /** Annual interest rate (%) for delayed payment clause on invoices */
    default_late_payment_interest_rate: { type: Number, default: 18 },
    default_tax_rate: { type: Number, default: 18 },
}, mongoSchemaOptions);

export default BillingProfileSchema;
