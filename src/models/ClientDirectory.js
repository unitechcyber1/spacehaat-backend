import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const ClientDirectorySchema = new Schema(
    {
        name: { type: String, default: '', index: true },
        company: { type: String, default: '', index: true },
        email: { type: String, default: '' },
        phone: { type: String, default: '' },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
        lastContactAt: { type: Date, default: () => new Date() },
        leadCount: { type: Number, default: 0 },
        wonCount: { type: Number, default: 0 },
    },
    { timestamps: true },
);

export default ClientDirectorySchema;
