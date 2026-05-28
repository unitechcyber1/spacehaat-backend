/**
 * Validates frontend / public API client on /api/user routes.
 * Set PUBLIC_API_KEY (or PUBLIC_API_KEYS=comma,separated) in .env.
 * Client sends header: x-client-key: <your-key>
 */

const HEADER_NAMES = ['x-client-key', 'x-api-key'];

function configuredKeys() {
    const single = [
        process.env.PUBLIC_API_KEY,
        process.env.CLIENT_API_KEY,
    ].filter(Boolean);

    const multi = (process.env.PUBLIC_API_KEYS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    return [...new Set([...single, ...multi])];
}

function configuredSecrets() {
    const single = [process.env.PUBLIC_API_SECRET, process.env.CLIENT_API_SECRET].filter(Boolean);
    const multi = (process.env.PUBLIC_API_SECRETS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    return [...new Set([...single, ...multi])];
}

function readHeader(req, name) {
    const v = req.headers[name];
    return v != null && String(v).trim() !== '' ? String(v).trim() : null;
}

function verifyPublicApiClient(req, res, next) {
    if (req.method === 'OPTIONS') {
        return next();
    }

    const keys = configuredKeys();
    const secrets = configuredSecrets();

    if (!keys.length) {
        if (process.env.NODE_ENV === 'production') {
            return res.status(503).json({
                type: 'Error',
                message: 'Public API client key is not configured on the server',
            });
        }
        console.warn(
            '[verifyPublicApiClient] PUBLIC_API_KEY is not set — allowing /api/user in non-production',
        );
        return next();
    }

    let providedKey = null;
    for (const name of HEADER_NAMES) {
        providedKey = readHeader(req, name);
        if (providedKey) break;
    }

    if (!providedKey || !keys.includes(providedKey)) {
        return res.status(403).json({
            type: 'Error',
            message: 'Invalid or missing API client key',
        });
    }

    if (secrets.length) {
        const providedSecret =
            readHeader(req, 'x-client-secret') || readHeader(req, 'x-client-token');
        if (!providedSecret || !secrets.includes(providedSecret)) {
            return res.status(403).json({
                type: 'Error',
                message: 'Invalid or missing API client secret',
            });
        }
    }

    return next();
}

export default verifyPublicApiClient;
