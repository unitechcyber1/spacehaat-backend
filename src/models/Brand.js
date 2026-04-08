import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

const BrandSchema = new Schema({
    name: { type: String, unique: true, required: true },
    description: String,
    order: { type: Number, default: 0 },
    review: String,
    logo_tag_line: String,
    trusted_user: {
        type: Boolean,
        default: false
    },
    should_show_on_home: {
        type: Boolean,
        default: false
    },
    type: {
        type: String,
        enum: ['coworking', 'coliving', 'officespace'],
        default: 'coworking'
    },
    image: {
        type: Schema.Types.ObjectId,
        ref: 'Image'
    },
    cities: [{
        type: Schema.Types.ObjectId,
        ref: 'City'
    }],
    google_sheet_url: {
        type: String
    },
    slug: String,
    brand_tag: String,
    brand_tag_line: String,
    images: [{
        image: {
            type: Schema.Types.ObjectId,
            ref: 'Image'
        },
        order: Number
    }],
    seo: {
        title: { type: String, required: true },
        description: { type: String, required: true },
        footer_title: String,
        footer_description: String,
        robots: String,
        keywords: String,
        url: String,
        status: {
            type: Boolean,
            default: true
        },
        twitter: {
            title: String,
            description: String,
            image: {
                type: Schema.Types.ObjectId,
                ref: 'Image'
            }
        },
        open_graph: {
            title: String,
            description: String,
            image: {
                type: Schema.Types.ObjectId,
                ref: 'Image'
            }
        }
    },
},
    mongoSchemaOptions
);


export default BrandSchema;
