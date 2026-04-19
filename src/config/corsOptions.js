/**
 * CORS for browser clients (admin on https://admin.spacehaat.com → API on https://api.spacehaat.com).
 * Set CORS_ORIGINS=comma,separated for extra exact origins.
 */

function buildAllowedOriginsSet() {
    const defaults = [
        'https://admin.spacehaat.com',
        'https://www.admin.spacehaat.com',
        'https://spacehaat.com',
        'https://www.spacehaat.com',
        'https://api.spacehaat.com',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000'
    ];
    const fromEnv = (process.env.CORS_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const extra = [process.env.FRONTEND_URL, process.env.ADMIN_URL].filter(Boolean);
    return new Set([...defaults, ...fromEnv, ...extra]);
}

/** True if this Origin header is allowed to call the API with credentials */
export function isOriginAllowed(origin) {
    if (!origin || typeof origin !== 'string') {
        return false;
    }
    const allowed = buildAllowedOriginsSet();
    if (allowed.has(origin.trim())) {
        return true;
    }
    try {
        const { hostname } = new URL(origin);
        if (hostname === 'spacehaat.com' || hostname.endsWith('.spacehaat.com')) {
            return true;
        }
    } catch {
        /* ignore */
    }
    return false;
}

const DEFAULT_ALLOW_HEADERS =
    'Content-Type, Authorization, token, x-client-key, x-client-token, x-client-secret, X-Requested-With, Accept, Origin';

/**
 * Handles preflight (OPTIONS) and sets CORS on all responses.
 * Use as the first middleware after trust proxy so OPTIONS never hits body parsers.
 */
export function corsMiddleware() {
    return (req, res, next) => {
        const origin = req.headers.origin;

        if (origin && isOriginAllowed(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Vary', 'Origin');
        }

        if (req.method === 'OPTIONS') {
            res.setHeader(
                'Access-Control-Allow-Methods',
                'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'
            );
            const requested = req.headers['access-control-request-headers'];
            res.setHeader(
                'Access-Control-Allow-Headers',
                requested && String(requested).trim() ? requested : DEFAULT_ALLOW_HEADERS
            );
            res.setHeader('Access-Control-Max-Age', '86400');
            return res.status(204).end();
        }

        next();
    };
}

/** @deprecated use corsMiddleware — kept if something still imports it */
export function buildCorsOptions() {
    return {
        origin(origin, callback) {
            if (!origin) {
                return callback(null, true);
            }
            return callback(null, isOriginAllowed(origin));
        },
        credentials: true,
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: DEFAULT_ALLOW_HEADERS.split(',').map((s) => s.trim()),
        optionsSuccessStatus: 204
    };
}
