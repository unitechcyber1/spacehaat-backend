// Central, scalable access catalogue.
//
// Access is modelled along two independent, extensible dimensions:
//   1. ROLES        — coarse buckets ('admin' | 'member'). Admin bypasses all checks.
//   2. PERMISSIONS  — fine-grained capability strings ('listings:read', ...).
//   3. SCOPES       — data-row filters (currently `cities`). New scope dimensions
//                     can be added later (e.g. `operators`, `teams`) without
//                     touching the permission machinery.
//
// To add a new capability later, append it to PERMISSIONS — nothing else hardcodes
// the list, so the model scales beyond city-based access.

export const ROLES = ['admin', 'member'];

export const PERMISSIONS = {
    LISTINGS_READ: 'listings:read',
    LISTINGS_WRITE: 'listings:write',
    PROPOSALS_READ: 'proposals:read',
    PROPOSALS_WRITE: 'proposals:write',
    LEADS_READ: 'leads:read',
    LEADS_WRITE: 'leads:write',
    LEADS_ASSIGN: 'leads:assign',
    USERS_MANAGE: 'users:manage',
};

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

// Sensible default capability set for a newly created member.
export const DEFAULT_MEMBER_PERMISSIONS = [
    PERMISSIONS.LISTINGS_READ,
    PERMISSIONS.PROPOSALS_READ,
    PERMISSIONS.PROPOSALS_WRITE,
    PERMISSIONS.LEADS_READ,
    PERMISSIONS.LEADS_WRITE,
];

// The authenticated principal attached to each request (req.user).

export function isAdmin(user) {
    return !!user && user.role === 'admin';
}

export function hasPermission(user, permission) {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return (user.permissions || []).includes(permission);
}

// Returns the cities a member is scoped to, or `null` meaning "no restriction"
// (admins, or members explicitly granted all cities).
export function cityScope(user) {
    if (!user || user.role === 'admin') return null;
    const cities = (user.cities || []).filter(Boolean);
    return cities.length ? cities : [];
}

/** Space-type scope for members. Empty/unset = no restriction (back-compat). */
export function spaceTypeScope(user) {
    if (!user || user.role === 'admin') return null;
    const types = (user.spaceTypes || []).filter(Boolean);
    return types.length ? types : null;
}
