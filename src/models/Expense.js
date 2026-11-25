import mongoose from 'mongoose';
const Schema = mongoose.Schema;

/**
 * One business expense, entered from the sales app (CRM). `person` is whose expense it is: a staff
 * user (`userId`) or, for admins, anyone else by name (an office helper, a vendor).
 */
const ExpenseSchema = new Schema(
    {
        amount: { type: Number, required: true, min: 0 },
        /** Day the money was spent, `YYYY-MM-DD` (India time), so month filters are simple string ranges. */
        date: { type: String, required: true, index: true },
        categoryId: { type: Schema.Types.ObjectId, ref: 'ExpenseCategory', required: true, index: true },
        note: { type: String, default: '' },
        person: {
            userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
            name: { type: String, default: '' },
        },
        /** Who paid: the company, the person themselves (company owes them), or someone else. */
        paidBy: { type: String, enum: ['company', 'self', 'other'], default: 'company' },
        paidByName: { type: String, default: '' },
        /** For `self` / `other`: whether the company has paid the money back. */
        settled: { type: Boolean, default: false },
        settledAt: { type: Date, default: null },
        receipt: {
            key: { type: String, default: '' },
            url: { type: String, default: '' },
        },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    },
    { timestamps: true },
);

ExpenseSchema.index({ date: -1, createdAt: -1 });

export default ExpenseSchema;
