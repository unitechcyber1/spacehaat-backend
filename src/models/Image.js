import { Schema } from 'mongoose';
import { mongoSchemaOptions } from '../utilities/constants.js';

const ImageSchema = new Schema({
        name: String,
        real_name: String,
        category: String,
        size: Number,
        height: Number,
        width: Number,
        s3_link: String,
        folder_name: String,
        title: String,
        title1: String,
        brightness: Number,
        contrast: Number,
    },
    mongoSchemaOptions
);


export default ImageSchema;