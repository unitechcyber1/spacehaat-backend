import mongoose from 'mongoose';
import { mongoSchemaOptions } from '../utilities/constants.js';

const { Schema } = mongoose;

const PricingInformationSchema = new Schema(
    {
        MonthlyRate: String,
        QuarterlyRate: String,
        AnnualRate: String,
        AnnualDiscountedRate: String
    },
    { _id: false }
);

const PlanFeaturesSchema = new Schema(
    {
        premiumList: { type: Boolean, default: false },
        verifiedTag: { type: Boolean, default: false },
        profPhotoshoot: { type: Boolean, default: false },
        socialMediaProm: { type: Boolean, default: false },
        propertyDesc: { type: Boolean, default: false },
        higherPosition: { type: Boolean, default: false }
    },
    { _id: false }
);

const PlanDetailsSchema = new Schema(
    {
        basicInfo: {
            planName: String,
            NumberOfProperties: String
        },
        pricingInformation: PricingInformationSchema,
        features: PlanFeaturesSchema,

        // Identifiers / metadata (present in sample payload)
        adminId: { type: Schema.Types.ObjectId, ref: 'User' },
        createdBy: String,
        userPurchased: String,
        plan_id: String,
        razorPayMonthlyId: String,
        razorPayQuarterlyId: String,
        razorPayYearlyId: String,
        status: String,
        createdAt: Date,
        updatedAt: Date
    },
    { _id: true }
);

const SubscriptionDetailsSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        planId: String,
        planDetails: [PlanDetailsSchema],
        propertyId: { type: Schema.Types.ObjectId },
        propertyModel: String,
        subscriptionType: String,
        subscriptionId: String,
        status: String,
        startDate: Date,
        endDate: Date,
        pdfUrl: String,
        createdAt: Date,
        updatedAt: Date
    },
    { _id: true }
);

const LaundryServiceSchema = new Schema(
    {
        title: String,
        days: String
    },
    { _id: false }
);

const PgRoomSchema = new Schema(
    {
        roomType: String,
        pgId: { type: Schema.Types.ObjectId, ref: 'PG' },
        monthlyRent: Number,
        expectedDeposit: Number,
        roomImage: { type: [Schema.Types.Mixed], default: [] },
        createdAt: Date,
        updatedAt: Date
    },
    { _id: true }
);

const PgRatingSchema = new Schema(
    {
        type: String,
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        locality: String,
        pgName: String,
        propId: { type: Schema.Types.ObjectId, ref: 'PG' },
        currentStatus: String,
        rating: Number,
        feedbacks: String,
        createdAt: Date,
        updatedAt: Date
    },
    { _id: true }
);

const PgPrioritySlotSchema = new Schema(
    {
        is_active: { type: Boolean, default: false },
        order: { type: Number, default: 1000 },
    },
    { _id: false },
);

const PgLocationPrioritySchema = new Schema(
    {
        city: { type: Schema.Types.ObjectId, ref: 'City' },
        is_active: { type: Boolean, default: false },
        order: { type: Number, default: 1000 },
    },
    { _id: false },
);

const PgMicroLocationPrioritySchema = new Schema(
    {
        name: String,
        city: { type: Schema.Types.ObjectId, ref: 'City' },
        is_active: { type: Boolean, default: false },
        order: { type: Number, default: 1000 },
    },
    { _id: false },
);

const PGSchema = new Schema(
    {
        pg_id: { type: String, index: true },
        slug: { type: String, index: true, trim: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        name: { type: String, required: true, trim: true },
        contactNumber: String,
        contactEmail: String,

        city: String,
        locality: String,
        address: String,
        street: String,

        // Mapped IDs from existing Country/State/City/MicroLocation collections
        locationIds: {
            address: String,
            country: { type: Schema.Types.ObjectId, ref: 'Country' },
            state: { type: Schema.Types.ObjectId, ref: 'State' },
            city: { type: Schema.Types.ObjectId, ref: 'City' },
            micro_location: [{ type: Schema.Types.ObjectId, ref: 'MicroLocation' }],
        },

        // GeoJSON point (lng, lat). Stored at root as shown in payload.
        location: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: { type: [Number], default: undefined }
        },

        // Same structure as WorkSpace/CoLivingSpace: references Image collection
        images: [{
            image: { type: Schema.Types.ObjectId, ref: 'Image' },
            order: Number
        }],

        rating: { type: Number, default: 0 },
        ratings: { type: [PgRatingSchema], default: [] },

        noticePeriod: { type: Boolean, default: false },
        noticePeriodDuration: { type: Number, default: 0 },
        maintenanceAmount: { type: Boolean, default: false },
        maintenanceAmountValue: String,
        foodIncluded: { type: Boolean, default: false },
        includedMeals: { type: [String], default: [] },
        pgHostelRule: { type: [String], default: [] },

        isLaundryService: { type: Boolean, default: false },
        laundryService: LaundryServiceSchema,
        roomCleaning: { type: Boolean, default: false },
        waterFacility: { type: Boolean, default: false },
        parking: { type: Boolean, default: false },

        availableAmenities: { type: [String], default: [] },
        roomAmenities: { type: [String], default: [] },

        gateClosing: { type: Boolean, default: false },
        gateClosingTime: String,

        preferredGuest: String,
        vehicleType: String,
        availableFor: String,
        availableFrom: Date,
        postBy: String,
        selectTimeSchedule: String,
        startTime: String,
        endTime: String,

        description: String,

        form_status: String,
        verified: { type: Boolean, default: false },
        views: { type: Number, default: 0 },
        status: {
            type: String,
            enum: ['pending', 'approve', 'reject', 'inprogress', 'Active'],
            default: 'inprogress',
        },
        active: { type: Boolean, default: true },
        adminApproved: { type: Boolean, default: false },
        adminApprovalDate: Date,

        delete: { type: Boolean, default: false },

        pgRooms: { type: [PgRoomSchema], default: [] },

        minMonthlyRent: Number,
        maxMonthlyRent: Number,
        singleRoomPrice: Number,

        /** Featured (overall) + city + locality ordering — mirrors WorkSpace.priority */
        priority: {
            overall: { type: PgPrioritySlotSchema, default: () => ({}) },
            location: { type: PgLocationPrioritySchema, default: () => ({}) },
            micro_location: { type: PgMicroLocationPrioritySchema, default: () => ({}) },
        },
        virtual_priority: {
            location: { type: PgLocationPrioritySchema, default: () => ({}) },
        },

        // References to PgOwner documents (separate collection)
        owner: [{ type: Schema.Types.ObjectId, ref: 'PgOwner' }]
    },
    mongoSchemaOptions
);

// Best-effort normalization: some sources send [lat, lng] instead of [lng, lat].
// If it looks like latitude first (|lat| < 45) and longitude second (|lng| > 45), swap.
PGSchema.pre('validate', function normalizeLocation(next) {
    try {
        const loc = this?.location;
        if (!loc || typeof loc !== 'object') {
            if (loc !== undefined) this.set('location', undefined);
            return next();
        }
        const coords = loc.coordinates;
        const valid =
            Array.isArray(coords) &&
            coords.length === 2 &&
            Number.isFinite(Number(coords[0])) &&
            Number.isFinite(Number(coords[1]));
        if (!valid) {
            this.set('location', undefined);
            return next();
        }
        const a = Number(coords[0]);
        const b = Number(coords[1]);
        const latFirstLikely = Math.abs(a) <= 45 && Math.abs(b) > 45;
        this.location = {
            type: 'Point',
            coordinates: latFirstLikely ? [b, a] : [a, b],
        };
        next();
    } catch (e) {
        next(e);
    }
});

PGSchema.index({ location: '2dsphere' });
PGSchema.index({ userId: 1 });

export default PGSchema;

