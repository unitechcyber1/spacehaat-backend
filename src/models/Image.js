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

        /** Used by `process-images-watermark-vision.js` */
        watermark_detected: Boolean,
        watermark_detection_checked_at: Date,
        watermark_detection_provider: String,
        watermark_removed: Boolean,
        watermark_pipeline_completed: Boolean,

        title: String,
        title1: String,
        brightness: Number,
        contrast: Number,
    },
    mongoSchemaOptions
);

ImageSchema.index({ s3_link: 1 });
ImageSchema.index({ watermark_pipeline_completed: 1 });
ImageSchema.index({ watermark_detection_checked_at: 1 });
ImageSchema.index({ watermark_detected: 1 });

export default ImageSchema;
