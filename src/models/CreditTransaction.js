import { Schema } from "mongoose";
import { mongoSchemaOptions } from "../utilities/constants.js";


const CreditTransactionSchema = new Schema({
    order: String,
    payment: String,
    amount: Number,
    credits: Number,
    from: Date,
    to: Date,
    month: Number,
    bookingId: String,
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    coliving: {
        type: Schema.Types.ObjectId,
        ref: 'CoLivingSpace'
    },
    status: {
        type: String,
        default: 'failed'
    }
},
    mongoSchemaOptions
)

export default CreditTransactionSchema;