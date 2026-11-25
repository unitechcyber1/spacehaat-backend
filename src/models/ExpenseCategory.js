import mongoose from 'mongoose';
const Schema = mongoose.Schema;

/** Expense heads (Travel, Food, …). Admins add them; archived ones stay on old expenses. */
const ExpenseCategorySchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        icon: { type: String, default: 'pricetag-outline' },
        active: { type: Boolean, default: true },
        order: { type: Number, default: 100 },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    },
    { timestamps: true },
);

export default ExpenseCategorySchema;
