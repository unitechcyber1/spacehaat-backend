import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const RefreshTokenSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        tokenHash: { type: String, required: true, unique: true, index: true },
        expiresAt: { type: Date, required: true, index: true },
        revokedAt: { type: Date, default: null },
    },
    { timestamps: true },
);

RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default RefreshTokenSchema;
