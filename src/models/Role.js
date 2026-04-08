import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

const RoleSchema = new Schema({
    name: { type: String, unique: true, required: true },
    description: String,
    login_type: {
        type: String,
        enum: ['user', 'admin', 'vendor'],
        default: 'admin'
    },
    permissions : [{
        tab_name: String,
        read: {
            type: Boolean,
            default: false
        },
        write : {
            type: Boolean,
            default: false
        }
    }]
},
    mongoSchemaOptions
);


export default RoleSchema;
