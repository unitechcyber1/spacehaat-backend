import crypto from 'crypto';
import models from '../../../models/index.js';

export const RefreshToken = models.RefreshToken;

export function hashRefreshToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateRefreshTokenValue() {
    return crypto.randomBytes(48).toString('base64url');
}
