import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const ActivitySchema = new Schema(
    {
        kind: { type: String, required: true },
        who: { type: String, required: true },
        text: { type: String, required: true },
        sub: { type: String, default: '' },
    },
    { timestamps: true },
);

export default ActivitySchema;
