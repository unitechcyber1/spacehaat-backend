import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

/**
 * Recommended virtual office options shown to user
 */
const RecommendedOptionSchema = new Schema(
    {
        location: String,
        city: String,
        price: Number,
        gst_applicable: {
            type: Boolean,
            default: true
        },
        turnaround_time: String // e.g. "24-48 hrs"
    },
    { _id: false }
);

/**
 * User selected option
 */
const SelectedOptionSchema = new Schema(
    {
        location: String,
        city: String,
        price: Number
    },
    { _id: false }
);

/**
 * Main Chatbot Session Schema
 */
const ChatbotSessionSchema = new Schema(
    {
        session_id: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        source: {
            type: String,
            default: 'virtual-office'
        },

        platform: {
            type: String,
            enum: ['web', 'whatsapp', 'mobile'],
            default: 'web'
        },

        user: {
            mobile: {
                type: String,
                index: true
            },
            email: String
        },

        flow: {
            city: String,
            location_preference: String,
            purpose: {
                type: String,
                enum: [
                    'GST Registration',
                    'Company Incorporation',
                    'Business Address'
                ]
            },
            company_type: {
                type: String,
                enum: [
                    'Partnership',
                    'LLP',
                    'Private Limited',
                    'OPC'
                ]
            }
        },

        recommended_options: [RecommendedOptionSchema],

        selected_option: SelectedOptionSchema,

        status: {
            current_step: {
                type: String,
                enum: [
                    'CONTACT',
                    'CITY',
                    'LOCATION',
                    'PURPOSE',
                    'COMPANY_TYPE',
                    'OPTIONS_SHOWN',
                    'DOCUMENTS',
                    'BOOKING',
                    'COMPLETED'
                ],
                default: 'CONTACT'
            },
            booked: {
                type: Boolean,
                default: false
            },
            completed: {
                type: Boolean,
                default: false
            },
            escalated_to_sales: {
                type: Boolean,
                default: false
            }
        },

        timestamps: {
            started_at: {
                type: Date,
                default: Date.now
            },
            last_updated_at: {
                type: Date,
                default: Date.now
            },
            completed_at: Date
        }
    },
    mongoSchemaOptions
);

/**
 * Auto update last_updated_at on save
 */
ChatbotSessionSchema.pre('save', function (next) {
    this.timestamps.last_updated_at = new Date();
    next();
});

export default ChatbotSessionSchema;
