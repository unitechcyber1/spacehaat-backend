import mongoose from 'mongoose';

const { ObjectId } = mongoose.Types;

function normalizeRole(role) {
    return String(role || '').trim().toLowerCase();
}

function normalizeRoles(user) {
    if (!user) return [];
    const raw = user.roles;
    if (Array.isArray(raw)) {
        return raw.map((r) => normalizeRole(r)).filter(Boolean);
    }
    if (typeof raw === 'string' && raw.trim()) {
        return [normalizeRole(raw)];
    }
    const role = normalizeRole(user.role);
    return role ? [role] : [];
}

/** Admin role sees all billing records; sales users only see records they created. */
export function isBillingAdmin(user) {
    if (!user) return false;
    if (user.isBillingAdmin === true) return true;

    const role = normalizeRole(user.role);
    const roles = normalizeRoles(user);
    return role === 'admin' || roles.includes('admin');
}

/** Only sales users are restricted to their own billing records. */
export function isBillingSalesScoped(user) {
    if (!user || isBillingAdmin(user)) return false;
    const role = normalizeRole(user.role);
    const roles = normalizeRoles(user);
    return role === 'sales' || roles.includes('sales');
}

export function actorId(user) {
    if (!user) return null;
    const id = user._id || user.id;
    if (!id) return null;
    return ObjectId.isValid(id) ? String(id) : null;
}

export function resolveCreatedById(req) {
    const user = actorUserFromRequest(req);
    const id = actorId(user);
    return id ? new ObjectId(id) : undefined;
}

/** Merge created_by filter into a Mongo query for sales users only. */
export function applyCreatedByScope(condition, user) {
    if (!isBillingSalesScoped(user)) return condition;
    const id = actorId(user);
    if (!id) return condition;
    const oid = new ObjectId(id);
    return {
        ...condition,
        created_by: { $in: [oid, id] },
    };
}

function sameActorId(recordOwner, actor) {
    if (!recordOwner || !actor) return false;
    return String(recordOwner) === String(actor);
}

export function assertBillingRecordAccess(record, user) {
    if (!isBillingSalesScoped(user)) return;
    const ownerId = record?.created_by;
    const actor = actorId(user);
    if (!sameActorId(ownerId, actor)) {
        throw { name: 'cofynd', code: 403, message: 'Access denied' };
    }
}

export function buildActorUser(userDoc, decryptedId, tokenRole) {
    const doc = userDoc?.toObject ? userDoc.toObject({ virtuals: true }) : (userDoc || {});
    const roles = normalizeRoles(doc);
    const role = normalizeRole(doc.role) || normalizeRole(tokenRole) || roles[0] || '';
    if (role && !roles.includes(role)) {
        roles.push(role);
    }
    const isAdmin = role === 'admin' || roles.includes('admin');

    return {
        _id: doc._id,
        id: decryptedId || (doc._id ? String(doc._id) : undefined),
        role,
        roles,
        email: doc.email,
        isBillingAdmin: isAdmin,
    };
}

export function actorUserFromRequest(req) {
    if (req?.user) return req.user;
    if (req?.admin?.id) {
        return {
            id: req.admin.id,
            role: req.admin.role,
            roles: req.admin.role ? [req.admin.role] : [],
            isBillingAdmin: normalizeRole(req.admin.role) === 'admin',
        };
    }
    return null;
}
