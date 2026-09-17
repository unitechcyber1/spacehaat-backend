import mongoose from 'mongoose';
import { mongoSchemaOptions } from '../utilities/constants.js';

const { Schema } = mongoose;

const InvoiceLineItemSchema = new Schema({
    catalog_item_id: { type: Schema.Types.ObjectId, ref: 'ProductCatalogItem' },
    sku: String,
    description: { type: String, required: true },
    details: String,
    hsn_sac: String,
    quantity: { type: Number, default: 1, min: 0 },
    unit: String,
    unit_price: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    taxable_amount: { type: Number, default: 0 },
    tax_rate: { type: Number, default: 18 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    line_total: { type: Number, default: 0 },
    period_start: Date,
    period_end: Date,
}, { _id: true });

const InvoiceEmailDeliverySchema = new Schema({
    sent_at: { type: Date, default: Date.now },
    sent_by: { type: Schema.Types.ObjectId, ref: 'User' },
    to: [{ type: String }],
    cc: [{ type: String }],
    bcc: [{ type: String }],
    reply_to: String,
    subject: String,
    message: String,
    attach_pdf: { type: Boolean, default: false },
    include_payment_link: { type: Boolean, default: true },
    ses_message_id: String,
    status: { type: String, enum: ['sent', 'failed'], default: 'sent' },
    error: String,
}, { _id: true });

const InvoiceEventSchema = new Schema({
    event: {
        type: String,
        enum: ['created', 'updated', 'issued', 'sent', 'paid', 'overdue', 'cancelled', 'voided', 'payment_link_created', 'converted_to_tax', 'email_sent', 'email_failed'],
    },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    note: String,
    at: { type: Date, default: Date.now },
}, { _id: true });

const InvoiceSchema = new Schema({
    invoice_number: { type: String, index: true, sparse: true },
    series_key: String,

    invoice_type: {
        type: String,
        enum: ['client', 'proforma', 'credit_note'],
        default: 'client',
    },
    status: {
        type: String,
        enum: ['draft', 'issued', 'sent', 'paid', 'overdue', 'cancelled', 'voided'],
        default: 'draft',
        index: true,
    },

    party_type: {
        type: String,
        enum: ['client', 'operator'],
        default: 'client',
    },

    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
    /** Standalone billing client (primary for new invoices) */
    billingClientId: { type: Schema.Types.ObjectId, ref: 'BillingClient', index: true },
    enquiryId: { type: Schema.Types.ObjectId, ref: 'Enquiry' },
    client_billing_profile_id: { type: Schema.Types.ObjectId, ref: 'ClientBillingProfile' },

    /** Cofynd GST registration state used on this invoice (e.g. 06 = Haryana) */
    seller_state_code: { type: String, index: true },

    /** If issued as proforma first, original number kept here when converted to tax invoice */
    proforma_invoice_number: String,
    converted_to_tax_at: Date,

    /** Manual commercial fields (operator settlement handled manually in Phase 3) */
    commercial: {
        cofynd_revenue: { type: Number, min: 0 },
        operator_payable: { type: Number, min: 0 },
        commission_notes: String,
    },

    space_type: {
        type: String,
        enum: ['Coworking Space', 'Office Space', 'PG', 'Coliving Space', 'Virtual Office'],
        index: true,
    },

    source: {
        type: String,
        enum: ['deal_done', 'renewal', 'manual', 'adjustment'],
        default: 'manual',
        index: true,
    },

    /** Idempotency: one draft per customer + source + period */
    idempotency_key: { type: String, index: true, sparse: true },

    issue_date: Date,
    due_date: Date,
    paid_at: Date,

    currency: { type: String, default: 'INR' },

    billing_snapshot: {
        seller: Schema.Types.Mixed,
        buyer: Schema.Types.Mixed,
    },

    line_items: { type: [InvoiceLineItemSchema], default: [] },

    subtotal: { type: Number, default: 0 },
    discount_total: { type: Number, default: 0 },
    taxable_amount: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    amount_paid: { type: Number, default: 0 },
    balance_due: { type: Number, default: 0 },

    tax_mode: {
        type: String,
        enum: ['intra_state', 'inter_state', 'export'],
        default: 'intra_state',
    },

    razorpay_order_id: String,
    razorpay_payment_id: String,
    payment_link_url: String,
    payment_link_id: String,

    notes: String,
    terms: String,

    html_snapshot: String,
    pdf_url: String,
    email_sent_at: Date,
    email_deliveries: { type: [InvoiceEmailDeliverySchema], default: [] },

    events: { type: [InvoiceEventSchema], default: [] },

    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
}, mongoSchemaOptions);

InvoiceSchema.index({ customerId: 1, status: 1, added_on: -1 });
InvoiceSchema.index({ billingClientId: 1, status: 1, added_on: -1 });
InvoiceSchema.index({ idempotency_key: 1 }, { unique: true, sparse: true });

export default InvoiceSchema;
