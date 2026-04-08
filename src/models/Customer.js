import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

const CustomerSchema = new Schema({
    client: {
        name: String,
        email: String,
        contact: String,
        company_name: String,
        website: String,
    },
    operator: {
        name: String,
        email: String,
        contact: String,
        space_name: String
    },
    location: {
        country: String,
        state: String,
        city: String,
        microlocation: String
    },
    space_type: {
        type: String,
        enum: ['Coworking Space', 'Coliving Space', 'Virtual Office', 'Others', 'Office Space']
    },
    date_of_closure: Date,
    start_date: Date,
    lease_expire_date: Date,
    lead_owner: String,
    no_of_seats: String,
    seat_price: String,
    agreement_duration: String,
    lockin_period: String,
    cofynd_revenue: String,
    payment_status: String,
    createdAt: { type: Date, default: Date.now },
},
    mongoSchemaOptions
);

export default CustomerSchema;