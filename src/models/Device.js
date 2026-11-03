import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const DeviceSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        token: { type: String, required: true, unique: true, index: true },
        platform: { type: String, enum: ['ios', 'android', 'web'], default: 'ios' },
        lastSeenAt: { type: Date, default: Date.now },
    },
    { timestamps: true },
);

export default DeviceSchema;
