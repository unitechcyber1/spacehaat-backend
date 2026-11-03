import { ApiError } from '../../utils/apiError.js';
import { hashPassword } from '../auth/auth.service.js';

import { STAFF_ROLES, User, toPublicUser, toUserRole, userPhoneNumber } from './users.model.js';

const GENDERS = ['male', 'female', 'other'];

export async function listUsers() {
    const docs = await User.find({ role: { $in: STAFF_ROLES } })
        .sort({ added_on: -1 })
        .exec();
    return docs.map((d) => toPublicUser(d));
}

export async function createUser(input, createdById) {
    const email = input.email.toLowerCase().trim();
    const existing = await User.exists({ email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    if (existing) {
        throw new ApiError(409, 'A user with this email already exists', 'EMAIL_TAKEN');
    }

    const passwordHash = await hashPassword(input.password);
    // Admins implicitly hold every permission, so we don't persist a list for them.
    const permissions = input.role === 'admin' ? [] : input.permissions;
    const cities = input.role === 'admin' ? [] : input.cities;
    const spaceTypes = input.role === 'admin' ? [] : input.spaceTypes;

    const doc = await User.create({
        name: input.name.trim(),
        email,
        phone_number: userPhoneNumber(input.phone),
        gender: GENDERS.includes(input.gender) ? input.gender : undefined,
        password: passwordHash,
        passwordHash,
        role: toUserRole(input.role),
        permissions,
        cities,
        spaceTypes,
        is_active: true,
        createdBy: createdById,
    });

    return toPublicUser(doc);
}

export async function updateUser(id, input, actingUserId) {
    const doc = await User.findById(id).exec();
    if (!doc) throw new ApiError(404, 'User not found', 'NOT_FOUND');

    if (!STAFF_ROLES.includes(doc.role)) throw new ApiError(404, 'User not found', 'NOT_FOUND');

    const isSelf = String(doc._id) === actingUserId;

    // Guard rails: an admin cannot lock themselves out.
    if (isSelf && input.status === 'disabled') {
        throw new ApiError(400, 'You cannot disable your own account', 'INVALID_OPERATION');
    }
    if (isSelf && input.role && input.role !== 'admin' && doc.role === 'admin') {
        throw new ApiError(400, 'You cannot remove your own admin role', 'INVALID_OPERATION');
    }

    // Prevent demoting/disabling the last remaining active admin.
    if (doc.role === 'admin' && (input.role === 'member' || input.status === 'disabled')) {
        const otherAdmins = await User.countDocuments({
            _id: { $ne: doc._id },
            role: 'admin',
            is_active: { $ne: false },
        });
        if (otherAdmins === 0) {
            throw new ApiError(400, 'At least one active admin is required', 'LAST_ADMIN');
        }
    }

    if (input.name !== undefined) doc.name = input.name.trim();
    if (input.phone !== undefined) doc.phone_number = userPhoneNumber(input.phone);
    if (input.gender !== undefined) doc.gender = GENDERS.includes(input.gender) ? input.gender : undefined;
    if (input.role !== undefined) doc.role = toUserRole(input.role);
    if (input.status !== undefined) doc.is_active = input.status === 'active';

    const effectiveRole = doc.role;
    if (effectiveRole === 'admin') {
        doc.permissions = [];
        doc.cities = [];
        doc.spaceTypes = [];
    } else {
        if (input.permissions !== undefined) doc.permissions = input.permissions;
        if (input.cities !== undefined) doc.cities = input.cities;
        if (input.spaceTypes !== undefined) doc.spaceTypes = input.spaceTypes;
    }

    if (input.password) {
        const passwordHash = await hashPassword(input.password);
        doc.set({ password: passwordHash, passwordHash });
    }

    await doc.save();
    return toPublicUser(doc);
}
