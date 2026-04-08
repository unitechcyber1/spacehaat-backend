import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const WhatsappReadStateSchema = new Schema({
    phone: { type: String, required: true, index: true, unique: true },
    lastSeenAt: { type: Date, default: new Date(0) }
}, {
    timestamps: true
});

WhatsappReadStateSchema.index({ phone: 1 });

export default WhatsappReadStateSchema;

