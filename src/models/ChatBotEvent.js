import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

const ChatbotEventSchema = new Schema(
    {
        session_id: {
            type: String,
            index: true,
            required: true
        },

        event: {
            type: String,
            enum: [
                'SESSION_STARTED',
                'STEP_COMPLETED',
                'OPTIONS_SHOWN',
                'OPTION_SELECTED',
                'BOOKING_STARTED',
                'BOOKING_COMPLETED',
                'SALES_ESCALATED',
                'DROPPED'
            ],
            required: true
        },

        step: String,

        value: Schema.Types.Mixed,

        created_at: {
            type: Date,
            default: Date.now
        }
    },
    mongoSchemaOptions
);

export default ChatbotEventSchema;
