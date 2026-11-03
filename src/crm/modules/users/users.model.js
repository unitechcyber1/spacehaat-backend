import { Types } from 'mongoose';
import models from '../../../models/index.js';

export const User = models.User;

/** Accounts that can use the sales apps. SB's `sales` role is the CRM's `member`. */
export const STAFF_ROLES = ['admin', 'sales'];
export const toCrmRole = (role) => (role === 'admin' ? 'admin' : 'member');
export const toUserRole = (role) => (role === 'admin' ? 'admin' : 'sales');

export const activeStaffFilter = { role: { $in: STAFF_ROLES }, is_active: { $ne: false } };

/** `phone_number` is required and unique on User, but optional for staff. */
const PLACEHOLDER_PHONE = /^crm-/;
export function userPhoneNumber(phone) {
    return phone?.trim() || `crm-${new Types.ObjectId()}`;
}

/** Shape safe to expose to clients (no password fields). */
export function toPublicUser(doc) {
    const phone = doc.phone_number || '';
    return {
        id: String(doc._id),
        name: doc.name,
        email: doc.email,
        phone: PLACEHOLDER_PHONE.test(phone) ? '' : phone,
        gender: doc.gender || 'unspecified',
        role: toCrmRole(doc.role),
        permissions: doc.permissions || [],
        cities: doc.cities || [],
        spaceTypes: doc.spaceTypes || [],
        status: doc.is_active === false ? 'disabled' : 'active',
        lastLoginAt: doc.lastLoginAt || null,
        createdAt: doc.added_on || null,
    };
}
