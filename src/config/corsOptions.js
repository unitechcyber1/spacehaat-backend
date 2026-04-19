/**
 * Browser Origin is the admin/site URL (e.g. https://admin.spacehaat.com), not the API URL.
 * Set CORS_ORIGINS as a comma-separated list for extra domains (e.g. staging).
 */
export function buildCorsOptions() {
    const defaults = [
        'https://admin.spacehaat.com',
        'https://www.admin.spacehaat.com',
        'https://spacehaat.com',
        'https://www.spacehaat.com',
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
    const allowed = new Set([...defaults, ...fromEnv, ...extra]);

    return {
        origin(origin, callback) {
            if (!origin) {
                return callback(null, true);
            }
            if (allowed.has(origin)) {
                return callback(null, true);
            }
            return callback(null, false);
        },
        credentials: true,
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
            'Origin',
            'X-Requested-With',
            'Content-Type',
            'Accept',
            'Authorization',
            'token',
            'x-client-key',
            'x-client-token',
            'x-client-secret'
        ],
        optionsSuccessStatus: 204
    };
}
