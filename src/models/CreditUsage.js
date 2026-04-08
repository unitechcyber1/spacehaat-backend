
import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

const CreditUsageSchema = new Schema({
    property: {
        type: Schema.Types.ObjectId,
        ref: 'CoLivingSpace'
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    type: {
        type: String,
        enum: ['free', 'purchased']
    }
},
    mongoSchemaOptions
)

export default CreditUsageSchema;