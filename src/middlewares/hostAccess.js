import models from '../models/index.js';

const WorkSpace = models['WorkSpace'];
const OfficeSpace = models['OfficeSpace'];
const PG = models['PG'];

/** Staff roles that may use the whole admin API (same roles the admin panel login accepts). */
const STAFF_ROLES = ['admin', 'sales'];

/** Read-only catalogue lookups the listing forms need. */
const HOST_CATALOG_ROUTES = [
    /^\/amenties$/,
    /^\/Active_category$/,
    /^\/Active_colivingCategory$/,
    /^\/countries$/,
    /^\/stateByCountry\/[^/]+$/,
    /^\/city\/getCityByCountryOnly\/[^/]+$/,
    /^\/city\/getCityByCountryState\/[^/]+$/,
    /^\/microLocationByCity\/[^/]+$/,
];

/** Listing routes: which model owns the id in the path, and the owner field on that model. */
const LISTING_BY_ID = [
    { re: /^\/(?:workSpace|userworkSpace)\/([^/]+)$/, model: WorkSpace, field: 'user', methods: ['GET', 'PUT'] },
    { re: /^\/(?:officeSpaces|userofficeSpaces)\/([^/]+)$/, model: OfficeSpace, field: 'user', methods: ['GET', 'PUT'] },
    { re: /^\/pg\/([^/]+)$/, model: PG, field: 'userId', methods: ['GET', 'PUT'] },
];

/** Fields only staff may set: approval, verification and featured placement. */
const STAFF_ONLY_FIELDS = ['status', 'adminApproved', 'verified', 'active', 'priority', 'planStatus'];

/** Copy of a host's listing body with `owner` set and staff-only fields removed. */
function hostBody(body, owner) {
    const next = { ...(body || {}) };
    for (const field of STAFF_ONLY_FIELDS) delete next[field];
    return { ...next, ...owner };
}

function isStaff(user) {
    const roles = [user?.role, ...(user?.roles || [])].map((r) => String(r || '').toLowerCase());
    return roles.some((r) => STAFF_ROLES.includes(r));
}

function forbidden(res) {
    return res.status(403).json({ type: 'Error', message: 'You do not have access to this resource.' });
}

/**
 * Hosts (list-your-space logins) receive a token for /api/admin, so without this they could call
 * every admin endpoint. Limit them to the listing flow, and to listings they own.
 * Runs after `jwtAdminVerify`; requests it let through without a user (login etc.) pass.
 */
export async function restrictHostAccess(req, res, next) {
    try {
        const user = req.user;
        if (!user || isStaff(user)) return next();

        const hostId = String(user._id || user.id || '');
        if (!hostId) return forbidden(res);

        const path = req.path.replace(/\/+$/, '') || '/';
        const method = req.method.toUpperCase();

        if (method === 'GET' && HOST_CATALOG_ROUTES.some((re) => re.test(path))) return next();

        // Image upload / replace.
        if (path === '/upload' && (method === 'POST' || method === 'PUT')) return next();

        // "My listings": always scoped to the signed-in host, whatever the query says.
        if (method === 'GET' && (path === '/workSpaces' || path === '/officeSpaces')) {
            req.query.userid = hostId;
            return next();
        }
        if (method === 'GET' && path === '/pgs') {
            req.query.userId = hostId;
            return next();
        }

        // New listing: owned by the signed-in host.
        if (method === 'POST' && (path === '/workSpace' || path === '/officeSpaces')) {
            req.body = hostBody(req.body, { user: hostId, added_by_user: 'seller' });
            return next();
        }
        if (method === 'POST' && path === '/pg') {
            req.body = hostBody(req.body, { userId: hostId });
            return next();
        }

        // Read or edit one listing: only if the host owns it.
        for (const route of LISTING_BY_ID) {
            const match = path.match(route.re);
            if (!match || !route.methods.includes(method)) continue;
            const doc = await route.model.findById(match[1], { [route.field]: 1 }).lean();
            if (!doc) return res.status(404).json({ type: 'Error', message: 'Listing not found.' });
            if (String(doc[route.field] || '') !== hostId) return forbidden(res);
            if (method === 'PUT') {
                req.body = hostBody(
                    req.body,
                    route.field === 'user' ? { user: hostId, added_by_user: 'seller' } : { userId: hostId },
                );
            }
            return next();
        }

        return forbidden(res);
    } catch (e) {
        return res.status(400).json({ type: 'Error', message: 'Invalid request.' });
    }
}
