import mongoose from 'mongoose';
import { mongoSchemaOptions } from '../utilities/constants.js';

const { Schema } = mongoose;

const ProductCatalogItemSchema = new Schema({
    sku: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    space_type: {
        type: String,
        enum: ['Coworking Space', 'Office Space', 'PG', 'Coliving Space', 'Virtual Office'],
        required: true,
        index: true,
    },
    category: {
        type: String,
        enum: ['service', 'renewal', 'deposit', 'addon', 'other'],
        default: 'service',
    },
    unit: {
        type: String,
        enum: ['flat', 'per_seat', 'per_month', 'per_year'],
        default: 'flat',
    },
    default_rate: { type: Number, required: true, min: 0 },
    tax_rate: { type: Number, default: 18, min: 0 },
    hsn_sac: { type: String, default: '997212' },
    is_taxable: { type: Boolean, default: true },
    enabled: { type: Boolean, default: true, index: true },
    sort_order: { type: Number, default: 100 },
}, mongoSchemaOptions);

ProductCatalogItemSchema.index({ space_type: 1, enabled: 1, sort_order: 1 });

export default ProductCatalogItemSchema;
