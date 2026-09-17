import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Atomic invoice number counter per series (e.g. CF/VO/06/2526) */
const InvoiceSequenceSchema = new Schema({
    series_key: { type: String, required: true, unique: true, index: true },
    last_number: { type: Number, default: 0 },
    fiscal_year: { type: String },
});

export default InvoiceSequenceSchema;
