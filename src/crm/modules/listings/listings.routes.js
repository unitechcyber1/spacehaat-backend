import { Router } from '../../utils/router.js';
import { validateBody } from '../../middleware/validate.js';
import { ApiError } from '../../utils/apiError.js';
import { requirePermission, requireRole } from '../auth/auth.middleware.js';
import { PERMISSIONS, cityScope } from '../auth/permissions.js';
import { ListingCreateSchema, ListingUpdateSchema } from './listings.schema.js';
import {
    createListing,
    deleteListing,
    getListing,
    listListings,
    listingsMeta,
    updateListing,
    verifyListing,
} from './listings.service.js';
import { inCityScope, listingsByIds } from './workspace-listings.js';

export const listingsRouter = Router();

function assertCityAllowed(req, city) {
    const scope = cityScope(req.user);
    if (scope === null) return;
    if (!city || !inCityScope(scope, city)) {
        throw new ApiError(403, 'This listing is outside your assigned cities', 'CITY_FORBIDDEN');
    }
}

function parseFreshness(query) {
    const raw =
        typeof query.fresh === 'string'
            ? query.fresh
            : typeof query.freshness === 'string'
              ? query.freshness
              : undefined;
    return raw === 'fresh' || raw === 'stale' || raw === 'expired' ? raw : undefined;
}

listingsRouter.get('/listings', requirePermission(PERMISSIONS.LISTINGS_READ), async (req, res) => {
    // ?ids=a,b,c → exactly those spaces, in order (proposal builder). Out-of-scope cities are left out.
    if (typeof req.query.ids === 'string') {
        const scope = cityScope(req.user);
        const ids = req.query.ids.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100);
        const rows = (await listingsByIds(ids)).filter((l) => inCityScope(scope, l.city));
        res.json({ items: rows, total: rows.length, page: 1, limit: rows.length, pageCount: 1 });
        return;
    }

    const city = typeof req.query.city === 'string' ? req.query.city : undefined;
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const freshness = parseFreshness(req.query);

    const maxPrice = typeof req.query.maxPrice === 'string' ? Number(req.query.maxPrice) : undefined;
    const minSeats = typeof req.query.minSeats === 'string' ? Number(req.query.minSeats) : undefined;
    const amenitiesRaw = req.query.amenities;
    const amenities =
        typeof amenitiesRaw === 'string'
            ? amenitiesRaw
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
            : Array.isArray(amenitiesRaw)
              ? amenitiesRaw
                    .map(String)
                    .flatMap((s) => s.split(','))
                    .map((s) => s.trim())
                    .filter(Boolean)
              : undefined;

    const buildingType = typeof req.query.buildingType === 'string' ? req.query.buildingType : undefined;
    const virtualOffice = req.query.virtualOffice === 'true';
    const managedOffice = req.query.managedOffice === 'true';
    const hotDesk = req.query.hotDesk === 'true';
    const vastu = req.query.vastu === 'true';

    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const pageRaw = typeof req.query.page === 'string' ? Number(req.query.page) : undefined;
    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;

    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const sort = typeof req.query.sort === 'string' ? req.query.sort : undefined;
    const options = { search, sort, withCounts: req.query.counts === 'true' };
    // Always paged over HTTP: the website has thousands of spaces.
    options.page = Number.isFinite(pageRaw) ? pageRaw : 1;
    options.limit = Number.isFinite(limitRaw) ? limitRaw : 100;

    const result = await listListings(
        {
            city,
            type,
            freshness,
            maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
            minSeats: Number.isFinite(minSeats) ? minSeats : undefined,
            amenities,
            buildingType,
            virtualOffice,
            managedOffice,
            hotDesk,
            vastu,
            status,
            allowedCities: cityScope(req.user),
        },
        options,
    );

    res.json(result);
});

// Filter options from the website's data: amenity names and plan types.
listingsRouter.get('/listings/meta', requirePermission(PERMISSIONS.LISTINGS_READ), async (_req, res) => {
    res.json(await listingsMeta());
});

listingsRouter.get('/listings/:id', requirePermission(PERMISSIONS.LISTINGS_READ), async (req, res) => {
    const item = await getListing(String(req.params.id));
    if (!item) throw new ApiError(404, 'Listing not found', 'NOT_FOUND');
    assertCityAllowed(req, item.city);
    res.json({ item });
});

listingsRouter.post(
    '/listings',
    requirePermission(PERMISSIONS.LISTINGS_WRITE),
    validateBody(ListingCreateSchema),
    async (req, res) => {
        assertCityAllowed(req, req.body.city);
        const item = await createListing(req.body);
        res.status(201).json({ item });
    },
);

listingsRouter.patch(
    '/listings/:id',
    requirePermission(PERMISSIONS.LISTINGS_WRITE),
    validateBody(ListingUpdateSchema),
    async (req, res) => {
        const existing = await getListing(String(req.params.id));
        if (!existing) throw new ApiError(404, 'Listing not found', 'NOT_FOUND');
        assertCityAllowed(req, existing.city);
        if (req.body.city) assertCityAllowed(req, req.body.city);
        const item = await updateListing(String(req.params.id), req.body);
        if (!item) throw new ApiError(404, 'Listing not found', 'NOT_FOUND');
        res.json({ item });
    },
);

listingsRouter.post('/listings/:id/verify', requirePermission(PERMISSIONS.LISTINGS_WRITE), async (req, res) => {
    const existing = await getListing(String(req.params.id));
    if (!existing) throw new ApiError(404, 'Listing not found', 'NOT_FOUND');
    assertCityAllowed(req, existing.city);
    const item = await verifyListing(String(req.params.id), req.user?.id);
    if (!item) throw new ApiError(404, 'Listing not found', 'NOT_FOUND');
    res.json({ item });
});

listingsRouter.delete('/listings/:id', requireRole('admin'), async (req, res) => {
    const item = await deleteListing(String(req.params.id));
    if (!item) throw new ApiError(404, 'Listing not found', 'NOT_FOUND');
    res.json({ item, deleted: true });
});
