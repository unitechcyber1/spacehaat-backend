import './loadEnv.js';

const DEFAULT_MONGODB_URI = 'mongodb://127.0.0.1:27017/spacehaat-prod';

function pickMongoUri() {
    const keys = [
        'MONGODB_URI',
        'MONGO_URI',
        'DATABASE_URL',
        'MONGODB_URL',
        'MONGO_URL'
    ];
    for (const key of keys) {
        const v = process.env[key];
        if (v && String(v).trim()) {
            return { uri: String(v).trim(), source: key };
        }
    }
    return { uri: DEFAULT_MONGODB_URI, source: 'default-localhost' };
}

const { uri, source } = pickMongoUri();

if (source === 'default-localhost') {
    console.warn(
        '[Database] No MongoDB URI in environment. Using default localhost. ' +
            'Set MONGODB_URI or MONGO_URI for production (systemd/PM2 env, or .env in project root).'
    );
} else {
    console.log(`[Database] Using connection string from ${source}`);
}

const database = {
    uri,
    /** Which env key supplied the URI, or "default-localhost" */
    uriSource: source
};

export default database;
