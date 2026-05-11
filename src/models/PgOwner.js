import mongoose from 'mongoose';
import { mongoSchemaOptions } from '../utilities/constants.js';

const { Schema } = mongoose;

/**
 * PG owner details stored as a separate collection.
 * NOTE: We intentionally do NOT store jwtToken here (sensitive).
 */
const PgOwnerSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },

        name: String,
        email: String,
        user_id: { type: String, index: true }, // external user id like USR-9737
        phone: { type: String, index: true },
        profileImage: String,

        isEmailVerify: Boolean,
        tenant: Boolean,
        whatsapp_opt_in: Boolean,
        active: Boolean,
        delete: Boolean,
        fcmToken: Schema.Types.Mixed,
        joinedAsTenant: Boolean,
        dailyContactCount: Number,

        // snapshot timestamps if present in payload
        createdAt: Date,
        updatedAt: Date
    },
    mongoSchemaOptions
);

PgOwnerSchema.index({ userId: 1 }, { unique: false });

export default PgOwnerSchema;

