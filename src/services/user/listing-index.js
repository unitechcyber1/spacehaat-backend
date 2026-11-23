import { ObjectId } from 'mongodb';
import models from '../../models/index.js';
import { blackListWS } from './manage-work-space.js';
import { pgIndexInGoogle, toPgSlug } from '../../utilities/pg-response-formatter.js';

const WorkSpace = models['WorkSpace'];
const ManagedOffice = models['ManagedOffice'];
const PG = models['PG'];

/** Plan categories that make a workspace a virtual office listing (same ids as `GET /workSpaces?virtual=true`). */
const VIRTUAL_PLAN_CATEGORIES = [
    '681075096db4f288ebc096fc',
    '681074d76db4f288ebc06e58',
    '681074ed6db4f288ebc080e5',
].map((id) => new ObjectId(id));

/** Only what the website's sitemaps, city links, brand links, listing counts and area summaries read. */
const LISTING_FIELDS = {
    name: 1,
    slug: 1,
    status: 1,
    is_active: 1,
    updated_on: 1,
    starting_price: 1,
    'new_seo.robots': 1,
    'new_seo.status': 1,
    'new_seo.title': 1,
    'location.city': 1,
    'location.micro_location': 1,
    'location.micro_location_string': 1,
    // Nearest metro, for the area pages' summary and "near a metro?" FAQ.
    'location.landmark': 1,
    'location.landmark_distance': 1,
    'location.is_near_metro': 1,
    'location.metro_stop_landmark': 1,
    'location.metro_detail': 1,
    'plans.category': 1,
    'plans.price': 1,
    'plans.duration': 1,
    'plans.should_show': 1,
    brand: 1,
};

/** One referenced document, reduced to `fields`, in place of its id (as the full lists return it). */
function lookupOne(from, localField, fields) {
    return [
        { $lookup: { from, localField, foreignField: '_id', as: localField, pipeline: [{ $project: fields }] } },
        { $addFields: { [localField]: { $arrayElemAt: ['$' + localField, 0] } } },
    ];
}

/** City, area, brand and plan category names, the same shapes the full list endpoints return. */
const LOOKUPS = [
    ...lookupOne('cities', 'location.city', { name: 1 }),
    ...lookupOne('microlocations', 'location.micro_location', { name: 1 }),
    ...lookupOne('brands', 'brand', { name: 1, slug: 1 }),
    {
        $lookup: {
            from: 'categories',
            localField: 'plans.category',
            foreignField: '_id',
            as: 'planCategories',
            pipeline: [{ $project: { name: 1 } }],
        },
    },
    {
        $addFields: {
            plans: {
                $map: {
                    input: { $ifNull: ['$plans', []] },
                    as: 'plan',
                    in: {
                        $mergeObjects: [
                            '$$plan',
                            {
                                category: {
                                    $ifNull: [
                                        {
                                            $arrayElemAt: [
                                                {
                                                    $filter: {
                                                        input: '$planCategories',
                                                        as: 'c',
                                                        cond: { $eq: ['$$c._id', '$$plan.category'] },
                                                    },
                                                },
                                                0,
                                            ],
                                        },
                                        '$$plan.category',
                                    ],
                                },
                            },
                        ],
                    },
                },
            },
        },
    },
    { $project: { planCategories: 0 } },
];

class ListingIndexService {
    /**
     * Every public listing in one small response, for the website's sitemaps and link directories.
     * Uses the same filters and order as the full list endpoints (`/workSpaces`,
     * `/workSpaces?virtual=true`, `/managedOffices?limit=1000`, `/pgs?sortBy=name&orderBy=1`)
     * but leaves out images, descriptions and SEO blocks: about 1 MB instead of about 37 MB.
     */
    async getListingIndex() {
        const workspaceMatch = { status: 'approve', slug: { $nin: blackListWS } };
        const [coworking, virtualOffice, managedOffices, pgs] = await Promise.all([
            WorkSpace.aggregate([
                { $match: workspaceMatch },
                { $project: { ...LISTING_FIELDS, 'priority.overall.order': 1 } },
                ...LOOKUPS,
                { $sort: { 'priority.overall.order': 1, _id: 1 } },
                { $project: { priority: 0 } },
            ]),
            WorkSpace.aggregate([
                { $match: { ...workspaceMatch, plans: { $elemMatch: { category: { $in: VIRTUAL_PLAN_CATEGORIES } } } } },
                { $project: { slug: 1, virtual_order_sort: { $ifNull: ['$virtual_priority.location.order', 999999] } } },
                { $sort: { virtual_order_sort: 1, _id: 1 } },
            ]),
            ManagedOffice.aggregate([
                { $match: { status: 'approve', is_active: { $ne: false } } },
                { $project: { ...LISTING_FIELDS, 'priority.overall': 1, added_on: 1 } },
                { $sort: { 'priority.overall.is_active': -1, 'priority.overall.order': 1, added_on: -1, _id: -1 } },
                { $limit: 1000 },
                ...LOOKUPS,
                { $project: { priority: 0, added_on: 0 } },
            ]),
            PG.find(
                { delete: { $ne: true }, active: true, status: 'approve' },
                { slug: 1, name: 1, city: 1, locality: 1, 'locationIds.city': 1, seo_index_override: 1, seo_quality_ok: 1 },
            )
                .sort({ name: 1, _id: 1 })
                .lean(),
        ]);

        return {
            coworking,
            virtual_office_slugs: virtualOffice.map((w) => w.slug),
            managed_offices: managedOffices,
            pgs: pgs.map((doc) => ({
                slug: toPgSlug(doc),
                name: doc.name || '',
                city: doc.city || '',
                locality: doc.locality || '',
                // Catalog city, for the same `locationIds.city` filter the PG list applies on area pages.
                city_id: doc.locationIds?.city ? String(doc.locationIds.city) : '',
                index_in_google: pgIndexInGoogle(doc),
            })),
        };
    }
}

export default new ListingIndexService();
