import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';
/** Product lines the CRM uses for access and routing. */
const SPACE_TYPE_LABELS = { CW: 'Web Coworking', VO: 'Virtual Office', CL: 'Web Coliving', OS: 'Office space' };

/** CRM space code for an enquiry's free-text `space_type` ("Web Coliving", "Virtual Office"...). */
export function spaceCodeFromLabel(label) {
    const value = String(label || '').toLowerCase();
    if (value.includes('virtual')) return 'VO';
    if (value.includes('coliving') || value.includes('pg')) return 'CL';
    if (value.includes('office')) return 'OS';
    return 'CW';
}

export function spaceLabelFromCode(code) {
    return SPACE_TYPE_LABELS[code] || SPACE_TYPE_LABELS.CW;
}

const EnquirySchema = new Schema({
    interested_in: String,
    visit_date: Date,
    note: String,
    space_type: String,
    budget: String,
    no_of_seats: String,
    page_url: String,
    category: String,
    rm: [{ type: String }],
    date_called: String,
    comment: String,
    microlocation: String,
    city: String,
    address: String,
    booking_date: Date,
    last_reminder_sent: { type: Number, default: 0 },
    leadSource: {
        type: String,
        enum: ['call', 'email', 'reference', 'contactForm', 'other', 'smart_match', 'manual', 'whatsapp'],
        default: 'contactForm'
    },
    companyName: String,
    tenure: String,
    notes: [{
        _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
        note: String,
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        /** Author's display name; kept with the note so it survives user changes. */
        who: String,
        added_on: { type: Date, default: Date.now },
        updated_on: Date
    }],
    cityId: {
        type: Schema.Types.ObjectId,
        ref: 'City'
    },
    location: [{
        type: String,
    }],
    work_space: {
        type: Schema.Types.ObjectId,
        ref: 'WorkSpace'
    },
    living_space: {
        type: Schema.Types.ObjectId,
        ref: 'CoLivingSpace'
    },
    office_space: {
        type: Schema.Types.ObjectId,
        ref: 'OfficeSpace'
    },
    managed_office: {
        type: Schema.Types.ObjectId,
        ref: 'ManagedOffice'
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    status: {
        type: String,
        enum: ['in-queue', 'follow-up', 'resolved'],
        default: 'in-queue'
    },
    lead_stage: {
        type: String,
        enum: ['New', 'Lead Called', 'CNA', 'Call Me Back', 'Interested', 'Proposal Sent', 'Site Visit Aligned', 'Site Visit Done', 'Agreement Stage', 'Security Deposited', 'Deal Done', 'Lead Lost'],
        default: 'New'
    },
    assignedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    other_info: {
        name: String,
        phone_number: String,
        email: String
    },
    email: {
        sent: Boolean,
        sentAt: Date,
        unsubscribed: Boolean
    },
    whatsapp: {
        sent: Boolean,
        sentAt: Date,
        replied: Boolean,
        optedOut: Boolean
    },
    whatsappSessionExpiry: { type: Date },
    isOtp: {
        type: Boolean,
        default: false
    },
    lead_id: String,

    /** CRM fields, used by the sales apps through /api/v1. */
    leadDate: { type: Date, default: () => new Date() },
    interestedIn: [{ type: String }],
    spaceType: { type: String, enum: Object.keys(SPACE_TYPE_LABELS) },
    /** Numeric seats and budget; `no_of_seats` and `budget` stay strings for the admin filters. */
    seats: Number,
    budgetAmount: Number,
    seatRange: String,
    moveIn: String,
    rawEnquiry: String,
    amenities: [{ type: String }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    listingIds: [{ type: Schema.Types.ObjectId, ref: 'Listing' }],
    proposalIds: [{ type: Schema.Types.ObjectId, ref: 'Proposal' }],
    visitIds: [{ type: Schema.Types.ObjectId }],
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    dueAt: Date,
    reminderSetAt: Date,
    reminderSentAt: Date,
    lostReason: String
},
    mongoSchemaOptions
);

EnquirySchema.pre('save', function (next) {
    if (!this.spaceType) this.spaceType = spaceCodeFromLabel(this.space_type);
    next();
});

EnquirySchema.index({ "added_on": -1 });
EnquirySchema.index({ "other_info.phone_number": 1 });
EnquirySchema.index({ "interested_in": 1 });
EnquirySchema.index({ "lead_id": 1 });
EnquirySchema.index({ "budget": 1 });
EnquirySchema.index({ "no_of_seats": 1 });
EnquirySchema.index({ "microlocation": 1 });
EnquirySchema.index({ "city": 1 });
EnquirySchema.index({ "leadDate": -1, "updated_on": -1 });
EnquirySchema.index({ "assignedUsers": 1 });
EnquirySchema.index({ "createdBy": 1 });
EnquirySchema.index({ "spaceType": 1 });
EnquirySchema.index({ "reminderSetAt": 1, "dueAt": 1 });

export default EnquirySchema;