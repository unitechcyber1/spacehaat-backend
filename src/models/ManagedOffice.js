import mongoose from 'mongoose';
const Schema = mongoose.Schema;
import { mongoSchemaOptions } from '../utilities/constants.js';


const seoSchema = {
    title: { type: String },
    description: { type: String },
    robots: String,
    keywords: String,
    url: String,
    status: { type: Boolean, default: true },
    twitter: {
        title: String,
        description: String,
        image: { type: Schema.Types.ObjectId, ref: 'Image' }
    },
    open_graph: {
        title: String,
        description: String,
        image: { type: Schema.Types.ObjectId, ref: 'Image' }
    }
};

const daySchema = (shouldShow = false) => ({
    from: String,
    to: String,
    should_show: { type: Boolean, default: shouldShow },
    is_closed: { type: Boolean, default: false },
    is_open_24: { type: Boolean, default: false }
});

const priorityBlock = {
    is_active: { type: Boolean, default: false },
    order: { type: Number, default: 1000 }
};

const ManagedOfficeSchema = new Schema({
    name: { type: String, required: true },
    description: String,
    new_description: String,
    slug: String,
    images: [{
        image: { type: Schema.Types.ObjectId, ref: 'Image' },
        order: Number
    }],
    amenties: [{ type: Schema.Types.ObjectId, ref: 'Amenty' }],
    seo: seoSchema,
    new_seo: seoSchema,
    location: {
        name: String,
        floor: String,
        address1: String,
        building_name: String,
        country: { type: Schema.Types.ObjectId, ref: 'Country' },
        state: { type: Schema.Types.ObjectId, ref: 'State' },
        city: { type: Schema.Types.ObjectId, ref: 'City' },
        micro_location: { type: Schema.Types.ObjectId, ref: 'MicroLocation' },
        micro_location_string: String,
        postal_code: String,
        landmark: String,
        landmark_distance: String,
        metro_stop_landmark: String,
        metro_stop_distance: String,
        latitude: Number,
        longitude: Number,
        is_near_metro: { type: Boolean, default: false }
    },
    geometry: {
        type: { type: String, default: 'Point' },
        coordinates: { type: [Number] }
    },
    hours_of_operation: {
        monday: daySchema(true),
        tuesday: daySchema(),
        wednesday: daySchema(),
        thursday: daySchema(),
        friday: daySchema(),
        saturday: daySchema(),
        sunday: daySchema()
    },
    plans: [{
        category: { type: Schema.Types.ObjectId, ref: 'Category' },
        image: { type: Schema.Types.ObjectId, ref: 'Image' },
        seat_type: {
            type: String,
            enum: ['warm_shell', 'ready_to_move_in', 'bare_shell']
        },
        duration: {
            type: String,
            enum: ['month', 'year', 'week', 'day', 'hour'],
            default: 'month'
        },
        time_period: Number,
        /** price per seat for the duration; 0 means price on request */
        price: Number,
        number_of_items: { type: Number, default: 1 },
        should_show: { type: Boolean, default: true }
    }],
    building: {
        total_floors: Number,
        super_area: Number,
        total_seats: Number,
        floors: [{
            floor_number: Number,
            area: Number,
            seats: Number,
            floor_plan: { type: Schema.Types.ObjectId, ref: 'Image' }
        }]
    },
    lease_terms: {
        min_seats: Number,
        min_duration_months: Number
    },
    rating: {
        source: String,
        average: Number,
        total: Number
    },
    centre_type: {
        type: String,
        enum: ['managed_office', 'coworking'],
        default: 'managed_office'
    },
    is_new_launch: { type: Boolean, default: false },
    no_of_seats: Number,
    brand: { type: Schema.Types.ObjectId, ref: 'Brand' },
    is_active: { type: Boolean, default: true },
    status: {
        type: String,
        enum: ['pending', 'approve', 'reject', 'inprogress'],
        default: 'pending'
    },
    priority: {
        overall: priorityBlock,
        location: { city: { type: Schema.Types.ObjectId, ref: 'City' }, ...priorityBlock },
        micro_location: {
            name: { type: Schema.Types.ObjectId, ref: 'MicroLocation' },
            city: { type: Schema.Types.ObjectId, ref: 'City' },
            ...priorityBlock
        }
    },
    is_popular: {
        value: { type: Boolean, default: false },
        order: Number
    },
    /** where an imported record came from, so re-imports update instead of duplicating */
    source: {
        provider: String,
        id: String,
        slug: String,
        amenities: [{ id: String, is_paid: Boolean, details: [String] }]
    },
    added_by_user: {
        type: String,
        enum: ['seller', 'admin'],
        default: 'admin'
    }
},
    mongoSchemaOptions
);

ManagedOfficeSchema.virtual('space_type').get(function () {
    return 'managed-office';
});
ManagedOfficeSchema.index({ geometry: '2dsphere' });
ManagedOfficeSchema.index({ slug: 1 }, { unique: true, sparse: true });
ManagedOfficeSchema.index({ 'source.provider': 1, 'source.id': 1 }, { unique: true, sparse: true });
ManagedOfficeSchema.index({ 'location.city': 1, status: 1 });

export default ManagedOfficeSchema;
