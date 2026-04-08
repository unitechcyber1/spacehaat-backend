import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const WhatsAppMessageSchema = new Schema({
    phone: { type: String, required: true, index: true },
    direction: {
        type: String,
        enum: ['inbound', 'outbound'],
        required: true
    },
    message: { type: String, required: true },
    messageSid: { type: String, required: true },
    status: { type: String },
    createdAt: { type: Date, default: Date.now }
});

WhatsAppMessageSchema.index({ phone: 1, createdAt: -1 });
WhatsAppMessageSchema.index({ phone: 1, direction: 1, createdAt: -1 });

export default WhatsAppMessageSchema;
