import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';

const CoworkingSchema = new Schema({
        name: { type: String, unique: true, required: true },
        country: {
            type: Schema.Types.ObjectId,
            ref: 'Country',
            required: true
        },
        page_heading: {
            type: String,
        },
        image: {
            type: Schema.Types.ObjectId,
            ref: 'Image',
            required: false
        },
        amenities: [{
            title: {
                type: String,
            },
            description: {
                type: String,
            },
            icon: {
                type: Schema.Types.ObjectId,
                ref: 'Image',
                required: false
            },
        }],
        booking_steps: {
            booking_heading: {
                type: String,
            },
            steps: [{
                step_number: { type: Number },
                step_name: { type: String },
                step_description: { type: String }
            }]
        },
        cofynd_advantages: {
            advantage_heading: {
                type: String,
            },
            advantage_steps: [{
                icon: {
                    type: Schema.Types.ObjectId,
                    ref: 'Image',
                    required: false
                },
                step_heading: { type: String },
                step_description: { type: String }
            }]
        },
        customize_solutions: {
            customize_heading: {
                type: String,
            },
            solution_steps: [{
                icon: {
                    type: Schema.Types.ObjectId,
                    ref: 'Image',
                    required: false
                },
                solution_step_heading: { type: String },
                solution_step_description: { type: String }
            }]
        },
        exclusive_cofynd: {
            image: {
                type: Schema.Types.ObjectId,
                ref: 'Image',
                required: false
            },
            url: { type: String }
        },
        list_your_space: {
            background_image: {
                type: Schema.Types.ObjectId,
                ref: 'Image',
                required: false
            },
            lys_heading: {
                type: String,
            },
            description: { type: String },
            button_test: { type: String },
            image: {
                type: Schema.Types.ObjectId,
                ref: 'Image',
                required: false
            },
        },
        questions: {
            ques_heading: {
                type: String,
            },
            ques_ans: [{
                ques: { type: String },
                ans: { type: String },
            }]
        },
        createdAt: { type: Date, default: Date.now },
    },
    mongoSchemaOptions
);
CoworkingSchema.index({ "country": 1 }, { unique: true })

export default CoworkingSchema;