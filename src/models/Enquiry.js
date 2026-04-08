import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';
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
        enum: ['call', 'email', 'reference', 'contactForm', 'other'],
        default: 'contactForm'
    },
    companyName: String,
    tenure: String,
    notes: [{
        _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
        note: String,
        user: { type: Schema.Types.ObjectId, ref: 'User' },
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
        enum: ['New', 'Lead Called', 'Interested', 'Proposal Sent', 'Site Visit Aligned', 'Site Visit Done', 'Agreement Stage', 'Security Deposited', 'Deal Done', 'Lead Lost'],
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
    lead_id: String
},
    mongoSchemaOptions
);
EnquirySchema.index({ "added_on": -1 });
EnquirySchema.index({ "other_info.phone_number": 1 });
EnquirySchema.index({ "interested_in": 1 });
EnquirySchema.index({ "lead_id": 1 });
EnquirySchema.index({ "budget": 1 });
EnquirySchema.index({ "no_of_seats": 1 });
EnquirySchema.index({ "microlocation": 1 });
EnquirySchema.index({ "city": 1 });

export default EnquirySchema;