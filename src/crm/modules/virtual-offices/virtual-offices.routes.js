import { Router } from '../../utils/router.js';
import { ApiError } from '../../utils/apiError.js';
import { requirePermission, requireRole } from '../auth/auth.middleware.js';
import { PERMISSIONS, cityScope, isAdmin } from '../auth/permissions.js';
import {
    createVirtualOffice,
    deleteVirtualOffice,
    getVirtualOffice,
    listVirtualOffices,
    serializeVo,
    updateVirtualOffice,
    virtualOfficeStats,
    voCityAllowed,
} from '../../../services/virtual-office-listings.js';

/**
 * Virtual office listings for the Haat app. Staff with listing access see the ones in their
 * cities; what the operator charges us is shown to admins only. Editing needs listings:write,
 * deleting is admin only.
 */
export const virtualOfficesRouter = Router();

const canRead = requirePermission(PERMISSIONS.LISTINGS_READ);
const canWrite = requirePermission(PERMISSIONS.LISTINGS_WRITE);
const q = (req) => Object.fromEntries(Object.entries(req.query).filter(([, v]) => typeof v === 'string'));
const actorOf = (user) => String(user?.name || user?.email || user?.id || '');

/** Service errors carry a status; turn them into the CRM's ApiError so the error middleware answers. */
async function run(fn) {
    try {
        return await fn();
    } catch (err) {
        if (err?.status && !(err instanceof ApiError)) throw new ApiError(err.status, err.message, err.code);
        throw err;
    }
}

function assertCity(user, city) {
    if (!voCityAllowed(cityScope(user), city)) {
        throw new ApiError(403, 'This virtual office is outside your assigned cities', 'CITY_FORBIDDEN');
    }
}

const out = (user, doc) => serializeVo(doc, { withCost: isAdmin(user) });

virtualOfficesRouter.get('/virtual-offices', canRead, async (req, res) => {
    const filters = q(req);
    if (!isAdmin(req.user) && filters.sortBy === 'annualPriceInr') delete filters.sortBy;
    res.json(await listVirtualOffices(filters, { allowedCities: cityScope(req.user), withCost: isAdmin(req.user) }));
});

virtualOfficesRouter.get('/virtual-offices/stats', canRead, async (req, res) => {
    res.json(await virtualOfficeStats({ allowedCities: cityScope(req.user) }));
});

virtualOfficesRouter.get('/virtual-offices/:id', canRead, async (req, res) => {
    const doc = await run(() => getVirtualOffice(String(req.params.id)));
    assertCity(req.user, doc.city);
    res.json({ item: out(req.user, doc) });
});

virtualOfficesRouter.post('/virtual-offices', canWrite, async (req, res) => {
    const body = { ...(req.body || {}) };
    // The operator price is admin-only, so members can't set it either.
    if (!isAdmin(req.user)) delete body.annualPriceInr;
    assertCity(req.user, String(body.city || ''));
    const doc = await run(() => createVirtualOffice(body, actorOf(req.user)));
    res.status(201).json({ item: out(req.user, doc) });
});

virtualOfficesRouter.patch('/virtual-offices/:id', canWrite, async (req, res) => {
    const current = await run(() => getVirtualOffice(String(req.params.id)));
    assertCity(req.user, current.city);
    const body = { ...(req.body || {}) };
    if (!isAdmin(req.user)) delete body.annualPriceInr;
    if (body.city !== undefined) assertCity(req.user, String(body.city));
    const doc = await run(() => updateVirtualOffice(String(req.params.id), body, actorOf(req.user)));
    res.json({ item: out(req.user, doc) });
});

virtualOfficesRouter.delete('/virtual-offices/:id', requireRole('admin'), async (req, res) => {
    await run(() => deleteVirtualOffice(String(req.params.id)));
    res.json({ ok: true });
});
