import { Types } from 'mongoose';
import { ApiError } from '../../utils/apiError.js';
import { hasPermission, isAdmin, PERMISSIONS } from '../auth/permissions.js';
import { STAFF_ROLES, User, activeStaffFilter, toCrmRole } from '../users/users.model.js';
import { Lead, cityMatcher, openLeadFilter } from './leads.model.js';

const LEAD_ACCESS_PERMS = [PERMISSIONS.LEADS_READ, PERMISSIONS.LEADS_WRITE];

function userCanTakeLeads(permissions = []) {
    return LEAD_ACCESS_PERMS.some((p) => permissions.includes(p));
}

function worksInCity(user, city) {
    const matcher = cityMatcher(city);
    return (user.cities || []).some((value) => matcher.test(value));
}

function memberMatchesSpaceType(user, spaceType) {
    if (!spaceType || user.role === 'admin') return true;
    const types = user.spaceTypes || [];
    // Empty spaceTypes = legacy unrestricted
    if (!types.length) return true;
    return types.includes(spaceType);
}

export async function assertAssigneeEligible(assigneeId) {
    if (!Types.ObjectId.isValid(assigneeId)) {
        throw new ApiError(400, 'Invalid assignee', 'INVALID_INPUT');
    }

    const user = await User.findById(assigneeId)
        .select('name role cities spaceTypes permissions is_active')
        .lean()
        .exec();
    if (!user || user.is_active === false || !STAFF_ROLES.includes(user.role)) {
        throw new ApiError(400, 'Assignee must be an active user', 'INVALID_INPUT');
    }

    if (user.role === 'admin') return user;

    // City and space-type scope only drive auto-assignment; a manual pick may go to anyone with lead access.
    if (!userCanTakeLeads(user.permissions || [])) {
        throw new ApiError(400, 'Assignee does not have lead access', 'INVALID_INPUT');
    }

    return user;
}

export async function findAutoAssigneeForCity(city, spaceType) {
    if (!city) return null;

    const members = await User.find({
        is_active: { $ne: false },
        role: 'sales',
        cities: cityMatcher(city),
        permissions: { $in: LEAD_ACCESS_PERMS },
    })
        .select('_id spaceTypes')
        .lean()
        .exec();

    const eligible = members.filter((m) => memberMatchesSpaceType(m, spaceType));

    if (eligible.length) {
        const scored = await Promise.all(
            eligible.map(async (member) => {
                const openLeads = await Lead.countDocuments({
                    'assignedUsers.0': member._id,
                    city: cityMatcher(city),
                    ...openLeadFilter(),
                }).exec();
                return { id: String(member._id), openLeads };
            }),
        );
        scored.sort((a, b) => a.openLeads - b.openLeads);
        return scored[0]?.id || null;
    }

    const admin = await User.findOne({ is_active: { $ne: false }, role: 'admin' })
        .select('_id')
        .lean()
        .exec();
    return admin ? String(admin._id) : null;
}

export async function resolveLeadAssignee(city, actor, requestedAssigneeId, spaceType) {
    if (requestedAssigneeId && Types.ObjectId.isValid(requestedAssigneeId)) {
        if (hasPermission(actor, PERMISSIONS.LEADS_ASSIGN) || isAdmin(actor)) {
            await assertAssigneeEligible(requestedAssigneeId);
            return requestedAssigneeId;
        }
        if (requestedAssigneeId === actor.id) return actor.id;
    }

    const auto = await findAutoAssigneeForCity(city, spaceType);
    if (auto) return auto;

    return actor.id;
}

export async function listLeadAssignees(city, actor, spaceType) {
    const users = await User.find(activeStaffFilter)
        .select('name email role cities spaceTypes permissions')
        .sort({ name: 1 })
        .lean()
        .exec();

    // Out-of-scope staff are listed too, after the matching ones.
    const eligible = users.filter((u) => u.role === 'admin' || userCanTakeLeads(u.permissions || []));

    const items = await Promise.all(
        eligible.map(async (u) => {
            const openLeads = await Lead.countDocuments({
                'assignedUsers.0': u._id,
                ...(city ? { city: cityMatcher(city) } : {}),
                ...openLeadFilter(),
            }).exec();
            return {
                id: String(u._id),
                name: u.name || '',
                email: u.email || '',
                role: toCrmRole(u.role),
                cities: u.cities || [],
                spaceTypes: u.spaceTypes || [],
                openLeads,
                matchesCity: !city || u.role === 'admin' || worksInCity(u, city),
                matchesSpaceType: memberMatchesSpaceType(u, spaceType),
            };
        }),
    );

    items.sort((a, b) => {
        if (a.matchesCity !== b.matchesCity) return a.matchesCity ? -1 : 1;
        if (a.matchesSpaceType !== b.matchesSpaceType) return a.matchesSpaceType ? -1 : 1;
        return a.openLeads - b.openLeads || a.name.localeCompare(b.name);
    });

    const suggestedId = city ? await findAutoAssigneeForCity(city, spaceType) : items[0]?.id || null;

    if (!hasPermission(actor, PERMISSIONS.LEADS_ASSIGN) && !isAdmin(actor)) {
        return { items: [], suggestedId, canAssign: false };
    }

    return { items, suggestedId, canAssign: true };
}

export async function attachAssigneeNames(items) {
    const ids = [...new Set(items.map((i) => i.assigneeId).filter(Boolean))];
    if (!ids.length) return items.map((i) => ({ ...i, assigneeName: '' }));

    const users = await User.find({ _id: { $in: ids } })
        .select('name')
        .lean()
        .exec();
    const byId = new Map(users.map((u) => [String(u._id), u.name || '']));
    return items.map((i) => ({
        ...i,
        assigneeName: i.assigneeId ? byId.get(i.assigneeId) || '' : '',
    }));
}
