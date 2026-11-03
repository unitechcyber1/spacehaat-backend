import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/apiError.js';
import { STAFF_ROLES, User, toCrmRole, toPublicUser } from '../users/users.model.js';
import { RefreshToken, generateRefreshTokenValue, hashRefreshToken } from './refreshToken.model.js';

const SALT_ROUNDS = 12;

export async function hashPassword(plain) {
    return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain, hash) {
    return bcrypt.compare(plain, hash);
}

export function signToken(userId, role, expiresIn = env.JWT_EXPIRES_IN) {
    return jwt.sign({ sub: userId, role }, env.JWT_SECRET, {
        expiresIn,
    });
}

export function signAccessToken(userId, role) {
    return signToken(userId, role, env.JWT_ACCESS_EXPIRES_IN);
}

function verifyToken(token) {
    try {
        const payload = jwt.verify(token, env.JWT_SECRET);
        if (typeof payload === 'object' && payload && typeof payload.sub === 'string') {
            return { sub: payload.sub };
        }
        return null;
    } catch {
        return null;
    }
}

function toAuthUser(doc) {
    return {
        id: String(doc._id),
        name: doc.name,
        email: doc.email,
        role: toCrmRole(doc.role),
        permissions: doc.permissions || [],
        cities: doc.cities || [],
        spaceTypes: doc.spaceTypes || [],
    };
}

function refreshExpiryDate() {
    const d = new Date();
    d.setDate(d.getDate() + env.JWT_REFRESH_EXPIRES_DAYS);
    return d;
}

async function issueRefreshToken(userId) {
    const value = generateRefreshTokenValue();
    await RefreshToken.create({
        userId,
        tokenHash: hashRefreshToken(value),
        expiresAt: refreshExpiryDate(),
    });
    return value;
}

export async function revokeRefreshToken(token) {
    const tokenHash = hashRefreshToken(token);
    await RefreshToken.updateOne({ tokenHash, revokedAt: null }, { $set: { revokedAt: new Date() } }).exec();
}

export async function revokeAllRefreshTokens(userId) {
    await RefreshToken.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } }).exec();
}

// Loads a fresh, active user for the given id — so role/permission/city/status
// changes take effect immediately (no stale token claims).
export async function getActiveAuthUser(userId) {
    const doc = await User.findById(userId).exec();
    if (!doc || doc.is_active === false || !STAFF_ROLES.includes(doc.role)) return null;
    return toAuthUser(doc);
}

export async function authenticateToken(token) {
    if (!token) return null;
    const payload = verifyToken(token);
    if (!payload) return null;
    return getActiveAuthUser(payload.sub);
}

export async function login(email, password, options = {}) {
    // Use a generic message for both unknown email and wrong password to avoid
    // user enumeration.
    const generic = new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');

    const escaped = email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const doc = await User.findOne({ email: new RegExp(`^${escaped}$`, 'i'), role: { $in: STAFF_ROLES } })
        .select('+passwordHash')
        .exec();
    if (!doc) throw generic;
    if (doc.is_active === false) {
        throw new ApiError(403, 'This account has been disabled', 'ACCOUNT_DISABLED');
    }

    const hashes = [doc.passwordHash, doc.password].filter(Boolean);
    const matches = await Promise.all(hashes.map((hash) => verifyPassword(password, hash)));
    if (!matches.includes(true)) throw generic;

    await User.updateOne({ _id: doc._id }, { $set: { lastLoginAt: new Date() } });

    const userId = String(doc._id);
    const role = toCrmRole(doc.role);
    const user = toPublicUser(doc);

    if (options.mobile) {
        const accessToken = signAccessToken(userId, role);
        const refreshToken = await issueRefreshToken(userId);
        return { user, accessToken, refreshToken };
    }

    const token = signToken(userId, role);
    return { token, user };
}

export async function refreshMobileSession(refreshToken) {
    const tokenHash = hashRefreshToken(refreshToken);
    const session = await RefreshToken.findOne({ tokenHash }).exec();

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
        throw new ApiError(401, 'Refresh token is invalid or expired', 'INVALID_REFRESH_TOKEN');
    }

    const user = await getActiveAuthUser(String(session.userId));
    if (!user) {
        throw new ApiError(401, 'User is no longer active', 'UNAUTHENTICATED');
    }

    session.revokedAt = new Date();
    await session.save();

    const accessToken = signAccessToken(user.id, user.role);
    const nextRefreshToken = await issueRefreshToken(user.id);

    return { accessToken, refreshToken: nextRefreshToken, user: await getPublicUserById(user.id) };
}

export async function getPublicUserById(userId) {
    const doc = await User.findById(userId).exec();
    if (!doc) return null;
    return toPublicUser(doc);
}
