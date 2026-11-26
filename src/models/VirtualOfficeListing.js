import { Schema } from 'mongoose';
import { mongoSchemaOptions } from '../utilities/constants.js';

/**
 * Virtual office listings, kept apart from coworking spaces: an operator's business-address plan
 * in one city / locality, with the price we pay (operator) and the price we sell at.
 * (`VirtualOffice` is an older, unused model kept only so old reviews still populate.)
 */
const VirtualOfficeListingSchema = new Schema({
    spaceName: { type: String, required: true, trim: true },
    slug: { type: String, trim: true, lowercase: true },
    city: { type: String, required: true, trim: true },
    cityId: { type: Schema.Types.ObjectId, ref: 'City', default: null },
    state: { type: String, trim: true, default: '' },
    locality: { type: String, trim: true, default: '' },
    fullAddress: { type: String, trim: true, default: '' },
    phoneNumber: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    isActive: { type: Boolean, default: true },
    /** What the operator charges us, per year. Internal: never shown to customers. */
    annualPriceInr: { type: Number, min: 0, default: 0 },
    monthlyPriceInr: { type: Number, min: 0, default: 0 },
    /** What the customer pays, per year. */
    sellingPriceInr: { type: Number, min: 0, default: 0 },
    sellingMonthlyPriceInr: { type: Number, min: 0, default: 0 },
    cityTier: { type: String, trim: true, default: '' },
    /** Comma-separated, e.g. "Business Address, Mail Handling, GST Registration". */
    amenities: { type: String, trim: true, default: '' },
    contactNotes: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    lastUpdatedLabel: { type: String, trim: true, default: '' },
    couponCode: { type: String, trim: true, uppercase: true, default: '' },
    couponPercentage: { type: Number, min: 0, max: 100, default: 0 },
    images: [{
        _id: false,
        url: { type: String, trim: true },
        name: { type: String, trim: true, default: '' },
        order: { type: Number, default: 0 },
    }],
    /** Id of the record this was imported from, so a re-run updates instead of duplicating. */
    importRef: { type: String, default: null },
    createdBy: { type: String, default: '' },
    updatedBy: { type: String, default: '' },
}, mongoSchemaOptions);

VirtualOfficeListingSchema.index({ slug: 1 }, { unique: true, sparse: true });
VirtualOfficeListingSchema.index({ importRef: 1 }, { sparse: true });
VirtualOfficeListingSchema.index({ city: 1, sellingPriceInr: 1 });
VirtualOfficeListingSchema.index({ isActive: 1 });

VirtualOfficeListingSchema.pre('validate', function syncDerivedFields(next) {
    this.isActive = String(this.status || 'Active').toLowerCase() === 'active';
    this.monthlyPriceInr = this.annualPriceInr > 0 ? Math.round(this.annualPriceInr / 12) : 0;
    this.sellingMonthlyPriceInr = this.sellingPriceInr > 0 ? Math.round(this.sellingPriceInr / 12) : 0;
    this.couponCode = String(this.couponCode || '').trim().toUpperCase();
    const pct = Number(this.couponPercentage);
    this.couponPercentage = this.couponCode && Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
    next();
});

export default VirtualOfficeListingSchema;
