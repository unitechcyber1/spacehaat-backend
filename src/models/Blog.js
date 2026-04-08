import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

const BlogSchema = new Schema({
    slug: String,
    description: String,
    heading: String,
    blog_type: {
        type: String,
        enum: ['coworking', 'coliving', 'office', 'virtualoffice'],
        default: 'coworking'
    },
    seo: {
        title: { type: String },
        description: { type: String },
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
    cover_picture: {
        type: Schema.Types.ObjectId,
        ref: 'Image'
    },
    detail: {
        news_image: {
            type: Schema.Types.ObjectId,
            ref: 'Image'
        },
        should_show_on_home: {
            type: Boolean,
            default: false
        },
        url: String
    },
    status: {
        type: String,
        enum: ['pending', 'approve', 'reject'],
        default: 'pending'
    },
},
    mongoSchemaOptions
);

BlogSchema.virtual('reading_time').get(function () {
    const wordCount = this.description && this.description.length || 0;
    const readingTimeInMinutes = Math.floor(wordCount / 228) + 1;
    return readingTimeInMinutes + " min";
});

// const Blog = mongoose.model("Blog", BlogSchema)

export default BlogSchema;