import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

const ReviewSchema = new Schema({
    description: String,
    rating: Number,
    review_history: {
        rating: Number,
        description: String
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    user_by_admin: {
       name: String,
       email: String,
       phone_number: String,
       company_name: String,
       designation: String,
    },
    space: {
        type: Schema.Types.ObjectId,
        required: false,
        refPath: 'on_model'
    },
    on_model: {
        type: String,
        required: false,
        enum: ['CoLivingSpace','WorkSpace','OfficeSpace']
    },
    space_type: {
        type: String,
        required: true,
        enum: ['CoLivingSpace','WorkSpace','OfficeSpace', 'VirtualOffice']
    },
    status: {
        type: String,
        enum: ['pending', 'approve', 'reject', 'in-review'],
        default: 'pending'
    },
    is_active: {
        type: Boolean,
        default: true
    }
},
    mongoSchemaOptions
);

// ReviewSchema.index({ user: 1, space: 1 }, { unique: true });


export default ReviewSchema;