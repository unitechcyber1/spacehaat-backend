import { Router } from '../../utils/router.js';
import { imageUpload } from '../../middleware/upload.js';
import { ApiError } from '../../utils/apiError.js';
import { requirePermission, requireRole } from '../auth/auth.middleware.js';
import { PERMISSIONS, canUseModule, cityScope } from '../auth/permissions.js';
import {
    createListing,
    deleteListing,
    getListing,
    listListings,
    listingsMeta,
    setListingStatus,
    setWebsiteVerification,
    updateListing,
    verifyListing,
} from './listings.service.js';
import { getPgEditable, pgEditorOptions } from './pg-editor.js';
import { inCityScope, listingsByIds } from './workspace-listings.js';
import {
    cityNameOf,
    editorOptions,
    getEditable,
    locationOptions,
    uploadWorkspaceImages,
} from './workspace-editor.js';
import { getManagedOfficeEditable, managedOfficeEditorOptions } from './managed-office-editor.js';
import { getPrivateOfficeEditable, privateOfficeEditorOptions } from './private-office-editor.js';

const VERTICALS = new Set(['coworking', 'managed-office', 'private-office', 'coliving']);
const MODULE_LABELS = {
    coworking: 'coworking spaces',
    'managed-office': 'managed offices',
    'private-office': 'private offices',
    coliving: 'PGs',
};
/** Edit-form shape of a coworking space, managed office, private office or PG (ids are unique across them). */
async function editableAny(id) {
    return (await getEditable(id)) || (await getManagedOfficeEditable(id)) || (await getPgEditable(id))
        || (await getPrivateOfficeEditable(id));
}

/** The section a listing belongs to (old CRM listings and coworking spaces have no `vertical` set). */
const moduleOf = (item) => (VERTICALS.has(item?.vertical) ? item.vertical : 'coworking');

/** Members only work in the sections their space types open (Coworking, Managed office, Private office, PG). */
function assertModule(req, vertical) {
    if (canUseModule(req.user, vertical)) return;
    throw new ApiError(403, `You do not have access to ${MODULE_LABELS[vertical] || vertical}`, 'MODULE_FORBIDDEN');
}

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
        const rows = (await listingsByIds(ids))
            .filter((l) => inCityScope(scope, l.city) && canUseModule(req.user, moduleOf(l)));
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
    const vertical = VERTICALS.has(req.query.vertical) ? req.query.vertical : 'coworking';
    assertModule(req, vertical);
    const seatType = typeof req.query.seatType === 'string' ? req.query.seatType : undefined;
    const gender = typeof req.query.gender === 'string' ? req.query.gender : undefined;
    const officeType = typeof req.query.officeType === 'string' ? req.query.officeType : undefined;
    const food = req.query.food === 'true';
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
            vertical,
            seatType,
            gender,
            officeType,
            food,
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

// Space form: dropdown data, location cascade, raw editable space, photo upload.
listingsRouter.get('/listings/editor/options', requirePermission(PERMISSIONS.LISTINGS_WRITE), async (req, res) => {
    const v = VERTICALS.has(req.query.vertical) ? req.query.vertical : 'coworking';
    assertModule(req, v);
    res.json(v === 'coliving' ? await pgEditorOptions() : v === 'managed-office' ? await managedOfficeEditorOptions()
        : v === 'private-office' ? await privateOfficeEditorOptions() : await editorOptions());
});

listingsRouter.get('/listings/editor/locations', requirePermission(PERMISSIONS.LISTINGS_WRITE), async (req, res) => {
    const q = (k) => (typeof req.query[k] === 'string' ? req.query[k] : '');
    res.json(await locationOptions({ country: q('country'), state: q('state'), city: q('city') }));
});

listingsRouter.post(
    '/listings/editor/images',
    requirePermission(PERMISSIONS.LISTINGS_WRITE),
    imageUpload.array('images', 20),
    async (req, res) => {
        if (!req.files?.length) throw new ApiError(400, 'No images provided', 'NO_FILES');
        res.status(201).json({ items: await uploadWorkspaceImages(req.files) });
    },
);

listingsRouter.get('/listings/:id', requirePermission(PERMISSIONS.LISTINGS_READ), async (req, res) => {
    const item = await getListing(String(req.params.id));
    if (!item) throw new ApiError(404, 'Listing not found', 'NOT_FOUND');
    assertModule(req, moduleOf(item));
    assertCityAllowed(req, item.city);
    res.json({ item });
});

listingsRouter.get('/listings/:id/edit', requirePermission(PERMISSIONS.LISTINGS_WRITE), async (req, res) => {
    const item = await editableAny(String(req.params.id));
    if (!item) throw new ApiError(404, 'Space not found', 'NOT_FOUND');
    assertModule(req, moduleOf(item));
    assertCityAllowed(req, item.labels.city);
    res.json({ item });
});

listingsRouter.post('/listings', requirePermission(PERMISSIONS.LISTINGS_WRITE), async (req, res) => {
    assertModule(req, moduleOf(req.body));
    assertCityAllowed(req, await cityNameOf(req.body?.location?.city));
    const item = await createListing(req.body || {}, req.user);
    res.status(201).json({ item });
});

listingsRouter.patch('/listings/:id', requirePermission(PERMISSIONS.LISTINGS_WRITE), async (req, res) => {
    const id = String(req.params.id);
    const existing = await editableAny(id);
    if (!existing) throw new ApiError(404, 'Space not found', 'NOT_FOUND');
    assertModule(req, moduleOf(existing));
    assertCityAllowed(req, existing.labels.city);
    assertCityAllowed(req, await cityNameOf(req.body?.location?.city));
    const item = await updateListing(id, req.body || {}, req.user);
    if (!item) throw new ApiError(404, 'Space not found', 'NOT_FOUND');
    res.json({ item });
});

listingsRouter.post('/listings/:id/verify', requirePermission(PERMISSIONS.LISTINGS_WRITE), async (req, res) => {
    const existing = await getListing(String(req.params.id));
    if (!existing) throw new ApiError(404, 'Listing not found', 'NOT_FOUND');
    assertModule(req, moduleOf(existing));
    assertCityAllowed(req, existing.city);
    const item = await verifyListing(String(req.params.id), req.user?.id);
    if (!item) throw new ApiError(404, 'Listing not found', 'NOT_FOUND');
    res.json({ item });
});

// Approve / Pending / In progress / Reject from the listing page: { status }. Needs "Enable / disable properties"
// (admins always), and only in the user's own sections and cities.
listingsRouter.post('/listings/:id/status', requirePermission(PERMISSIONS.LISTINGS_ENABLE), async (req, res) => {
    const id = String(req.params.id);
    const existing = await getListing(id);
    if (!existing) throw new ApiError(404, 'Listing not found', 'NOT_FOUND');
    assertModule(req, moduleOf(existing));
    assertCityAllowed(req, existing.city);
    const item = await setListingStatus(id, String(req.body?.status || ''));
    if (!item) throw new ApiError(404, 'Listing not found', 'NOT_FOUND');
    res.json({ item });
});

// Website "Verified on <date>" badge (coworking spaces and PGs): { method: call|visit|documents } or { remove: true }.
listingsRouter.post('/listings/:id/website-verification', requirePermission(PERMISSIONS.LISTINGS_WRITE), async (req, res) => {
    const id = String(req.params.id);
    const existing = await getListing(id);
    if (!existing) throw new ApiError(404, 'Listing not found', 'NOT_FOUND');
    assertModule(req, moduleOf(existing));
    assertCityAllowed(req, existing.city);
    const verification = await setWebsiteVerification(id, req.body || {}, req.user);
    if (!verification) throw new ApiError(404, 'Only coworking spaces and PGs have the website badge', 'NOT_SUPPORTED');
    res.json({ verification });
});

listingsRouter.delete('/listings/:id', requireRole('admin'), async (req, res) => {
    const item = await deleteListing(String(req.params.id));
    if (!item) throw new ApiError(404, 'Listing not found', 'NOT_FOUND');
    res.json({ item, deleted: true });
});
