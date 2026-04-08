import { Schema } from 'mongoose';
import { mongoSchemaOptions } from '../utilities/constants.js';

const BookingSchema = new Schema({
    order: String,
    payment: String,
    amount: Number,
    count: Number,
    from: Date,
    to: Date,
    month: Number,
    bookingId: String,
    bookingDates: [{type: String}],
    category: {
        type: Schema.Types.ObjectId,
        ref: 'Category'
    },
    gstDetails: {
     name: String,
     gst: String,
     address: String
    },
    visitors: [{
        name: String,
        email: String,
        phone_number: Number,
        gender: {
            type: String,
            enum: ['male', 'female', 'other']
        }
    }],
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    work_space: {
        type: Schema.Types.ObjectId,
        ref: 'WorkSpace'
    },
    status: {
        type: String,
        default: 'failed'
    }
},
    mongoSchemaOptions
)


export default BookingSchema;