import mongoose from 'mongoose';
import { mongoSchemaOptions } from '../utilities/constants.js';
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    name: { type: String },
    email: {
        type: String,
    },
    password: { type: String },
    dob: {
        type: Date
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other']
    },
    phone_number: {
        type: String,
        unique: true,
        required: true
    },
    credits: { type: Number },
    isFreeCredit: { type: Boolean },
    dial_code: {
        type: String,
    },
    google_sheet: {
        type: String,
    },
    sales_contact: {
        type: String,
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'vendor', 'sales'],
        default: 'user'
    },
    roles: [{
        type: String,
        enum: ['user', 'admin', 'vendor', 'sales']
    }],
    login_type: {
        type: String,
        enum: ['cofynd', 'google', 'facebook'],
        default: 'cofynd'
    },
    access: [{ type: String }],
    lead_source: [{ type: String }],
    create_lead: {
        type: Boolean,
        default: false
    },
    isLeadReminder: {
        type: Boolean,
        default: false
    },
    isMarketing: {
        type: Boolean,
        default: false
    },
    enquiry: [{
        space: {
            type: String
        },
        cities: [{
            city: { type: String },
            seats: [{ type: String }],
            budget: [{ type: String }],
            colivingType: [{ type: String }],
            workSpaceType: [{ type: String }],
            locations: [{ type: String }]
        }],
    }],
    inventory: {
        isInventory: {
            type: Boolean,
            default: false
        },
        cities: [{
            type: String
        }],
    },
    shown_filter: {
        interestedIn: {
            type: Boolean,
            default: false
        },
        location: {
            type: Boolean,
            default: false
        },
        address: {
            type: Boolean,
            default: false
        },
        space_type: {
            type: Boolean,
            default: false
        },
        status: {
            type: Boolean,
            default: false
        },
        budget: {
            type: Boolean,
            default: false
        },
        seats: {
            type: Boolean,
            default: false
        },
        dateTime: {
            type: Boolean,
            default: false
        }
    },
    shown_column: {
        interestedIn: {
            type: Boolean,
            default: false
        },
        location: {
            type: Boolean,
            default: false
        },
        address: {
            type: Boolean,
            default: false
        },
        space_type: {
            type: Boolean,
            default: false
        },
        status: {
            type: Boolean,
            default: false
        },
        budget: {
            type: Boolean,
            default: false
        },
        seats: {
            type: Boolean,
            default: false
        },
        dateTime: {
            type: Boolean,
            default: false
        },
        pageUrl: {
            type: Boolean,
            default: false
        },
        leadId: {
            type: Boolean,
            default: false
        },
        delete: {
            type: Boolean,
            default: false
        },
        editlead: {
            type: Boolean,
            default: false
        },
        comments: {
            type: Boolean,
            default: false
        }
    },
    is_active: {
        type: Boolean,
        default: true
    },
    is_profile_updated: {
        type: Boolean,
        default: false
    },
    is_mobile_verified: {
        type: Boolean,
        default: false
    },
    is_email_verified: {
        type: Boolean,
        default: false
    },
    profile_pic: {
        type: Schema.Types.ObjectId,
        ref: 'Image',
        required: false
    },
    otp: Number,
    otp_expires: {
        type: Date,
        default: new Date()
    },
    country: {
        type: Schema.Types.ObjectId,
        ref: 'Country'
    },
    state: {
        type: Schema.Types.ObjectId,
        ref: 'State'
    },
    city: {
        type: Schema.Types.ObjectId,
        ref: 'City'
    },
    postal_code: {
        type: String
    },
    Bio: {
        type: String
    },
    createdAt: { type: Date, default: Date.now },
},
    mongoSchemaOptions
);


export default UserSchema;