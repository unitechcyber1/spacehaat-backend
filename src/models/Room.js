import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

const RoomSchema = new Schema({
    name: { type: String, unique: true, required: true },
    description: String
},
    mongoSchemaOptions
);


export default RoomSchema;
