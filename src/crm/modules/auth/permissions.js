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
    // Add and see one's own expenses (admins see and manage everyone's).
    EXPENSES_WRITE: 'expenses:write',
    // Approve / reject a property and switch it on or off on the website, in the sections the user has.
    LISTINGS_ENABLE: 'listings:enable',
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

/**
 * Space types a user can be given. Each one opens an inventory section in the apps and routes leads:
 *   CW coworking · MO managed office · PO private office · CL PG / coliving · VO virtual office.
 * OS (office space) is the older code for both office sections; it is kept so existing users still work.
 */
export const USER_SPACE_TYPES = ['CW', 'MO', 'PO', 'CL', 'VO', 'OS'];

/** Inventory section (the apps' `vertical`) → the space types that open it. */
export const MODULE_SPACE_TYPES = {
    coworking: ['CW'],
    'managed-office': ['MO', 'OS'],
    'private-office': ['PO', 'OS'],
    coliving: ['CL'],
    'virtual-office': ['VO'],
};
export const INVENTORY_MODULES = Object.keys(MODULE_SPACE_TYPES);

/** Sections a user may see: every section for admins, else only those their space types open. */
export function inventoryModules(user) {
    if (!user) return [];
    if (user.role === 'admin') return [...INVENTORY_MODULES];
    const types = new Set((user.spaceTypes || []).filter(Boolean));
    return INVENTORY_MODULES.filter((m) => MODULE_SPACE_TYPES[m].some((t) => types.has(t)));
}

export function canUseModule(user, vertical) {
    return inventoryModules(user).includes(vertical);
}

/** May approve / reject a property and switch it on or off (admins always). */
export function canEnableListings(user) {
    return hasPermission(user, PERMISSIONS.LISTINGS_ENABLE);
}

/**
 * Lead space types a member works on (lead codes CW / VO / CL / OS), or null = no restriction (back-compat).
 * Managed office and private office both work on "Office space" (OS) leads.
 */
export function spaceTypeScope(user) {
    if (!user || user.role === 'admin') return null;
    const types = (user.spaceTypes || []).filter(Boolean);
    if (!types.length) return null;
    return [...new Set(types.map((t) => (t === 'MO' || t === 'PO' ? 'OS' : t)))];
}
