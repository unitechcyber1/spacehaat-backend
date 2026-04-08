import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

const ScheduleSchema = new Schema({
    name: {
        first: String,
        middle: String,
        last: String
    },
    email: String,
    phone_number: String,
    visit_date: Date,
    no_of_person: Number,
    interested_in: String,
    message: String,
    status: {
        type: String,
        enum: ['in_progress', 'cancel', 'done', 're_arrange'],
        default: 'in_progress'
    },
    work_space: {
        type: Schema.Types.ObjectId,
        ref: 'WorkSpace'
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
},
    mongoSchemaOptions
);


export default ScheduleSchema;
