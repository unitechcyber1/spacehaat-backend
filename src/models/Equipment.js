import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

const EquipmentSchema = new Schema({
    name: { type: String, unique: true, required: true },
    icon: String
},
    mongoSchemaOptions
);

export default EquipmentSchema;
