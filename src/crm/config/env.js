import crypto from 'crypto';
import '../../config/loadEnv.js';
import storage from '../../config/storage.js';

/** A key of its own, so CRM tokens never validate on the admin API (and vice versa). */
function deriveJwtSecret() {
    if (process.env.CRM_JWT_SECRET) return process.env.CRM_JWT_SECRET;
    if (!process.env.JWT_SECRET_ADMIN) return undefined;
    return crypto.createHash('sha256').update(`crm:${process.env.JWT_SECRET_ADMIN}`).digest('hex');
}

const toInt = (value, fallback) => {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Settings for the sales CRM API (/api/v1, used by haat-web-app and haat-mobile-app). */
export const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',

    JWT_SECRET: deriveJwtSecret(),
    JWT_EXPIRES_IN: process.env.CRM_JWT_EXPIRES_IN || '7d',
    JWT_ACCESS_EXPIRES_IN: process.env.CRM_JWT_ACCESS_EXPIRES_IN || '15m',
    JWT_REFRESH_EXPIRES_DAYS: toInt(process.env.CRM_JWT_REFRESH_EXPIRES_DAYS, 30),
    COOKIE_NAME: process.env.CRM_COOKIE_NAME || 'spacehaat_token',

    AWS_ACCESS_KEY_ID: storage.s3.key,
    AWS_SECRET_ACCESS_KEY: storage.s3.secret,
    AWS_REGION: storage.s3.region,
    AWS_S3_BUCKET: storage.s3.bucket,
    AWS_S3_FOLDER: process.env.CRM_S3_FOLDER || 'inventory',
    AWS_S3_PUBLIC_URL: process.env.CRM_S3_PUBLIC_URL,

    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',

    /** Push notifications and background jobs. Set to false on local machines so they don't message real staff. */
    NOTIFICATIONS_ENABLED: process.env.CRM_NOTIFICATIONS_ENABLED !== 'false',
};

export const isProd = env.NODE_ENV === 'production';
