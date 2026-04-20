import './config/loadEnv.js';
import express from 'express';
let app = express();
// Required for Twilio webhook signature validation behind ngrok/reverse proxy
app.set('trust proxy', 1);
import cors from 'cors';
// import {app as  envapp} from './config/app';
import database from './config/database.js'
import logger from './utilities/logger.js';
import portapp from "./config/app.js"
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
const PORT = portapp.port;
import bodyParser from 'body-parser';
import http from 'http';
import fileUpload from 'express-fileupload';
import logErrors from './middlewares/logErrors.js';
import { clientErrorHandler } from './middlewares/clientErrorHandler.js';
import CheckToken from './middlewares/checkToken.js';
import Sanatize from './middlewares/sanatize.js';
import path from 'path';
import queue from './utilities/queue.js';
import redis from './utilities/redis.js';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import adminRoutes from './routes/admin/index.js'
import userRoutes from './routes/user/index.js'
import whatsappRoutes from './routes/admin/manageWhatsapp.js'
import { initSocket } from './utilities/socket.js'
import storage from './config/storage.js'
import { limiter } from './config/rateLimiter.js';
import compression from 'compression';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let server = http.Server(app);
initSocket(server);

/*
    Mongoose setup
*/

const mongoStateLabel = (state) =>
    ({ 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' }[state] ?? 'unknown');

mongoose.connection.on('connected', () => {
    const { name, host } = mongoose.connection;
    console.log(`[Database] MongoDB connected (db: ${name ?? 'n/a'}, host: ${host ?? 'n/a'})`);
    logger.info(`MongoDB connected (db: ${name ?? 'n/a'})`, 'Database');
});

mongoose.connection.on('disconnected', () => {
    console.warn(`[Database] MongoDB disconnected (${mongoStateLabel(mongoose.connection.readyState)})`);
    logger.warn('MongoDB disconnected', 'Database');
});

mongoose.connection.on('error', (err) => {
    console.error('[Database] MongoDB error:', err.message);
    logger.error(err, 'Database');
});

mongoose.Promise = global.Promise;

mongoose.connect(database.uri).catch((err) => {
    console.error('[Database] MongoDB initial connection failed:', err.message);
    logger.error(err, 'Database');
});

/*
     XSS Security
*/
app.use(compression());
app.use(cookieParser('T9L', {
    httpOnly: true
}));


/*
    initialising queue and mail
*/

queue.init();
redis.init();

/*
    CSRF Security error handler
*/
app.use(function (err, req, res, next) {
    if (err.code !== 'EBADCSRFTOKEN') {
        return next(err)
    } else {

        res.status(403).send({
            status: -2,
            message: 'Unauthorized'
        });
        res.end();
    }
})


app.use(fileUpload({
    debug: true,
    limits: { fileSize: storage.maxFileSize }
}));
// CSP: allow Socket.IO CDN and WebSocket; production uses API_URL / FRONTEND_URL from env
const isProd = process.env.NODE_ENV === 'production';
const apiUrl = process.env.API_URL || process.env.SERVER_URL || '';
const cspConnectSrc = ["'self'", "ws://localhost:*", "http://localhost:*", "wss://localhost:*"];
if (isProd && apiUrl) {
    const u = apiUrl.replace(/^http:\/\//, 'https://').replace(/\/$/, '');
    cspConnectSrc.push(u, u.replace(/^https:/, 'wss:'));
}
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        crossOriginEmbedderPolicy: false,
        // JSON API — CSP is for HTML; disabling avoids odd interactions with proxies/CDNs
        contentSecurityPolicy: false
    })
);
app.use(cors())
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }));
app.use(express.json());
app.use(limiter)

// use it before all route definitions
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-client-key, x-client-token, x-client-secret, Authorization, token");
    next();
});

app.get('/', (req, res) => {
    res.send("Server connected successfully!")
});

/** MongoDB readiness: readyState 1 + admin ping when possible */
app.get('/health', async (req, res) => {
    const readyState = mongoose.connection.readyState;
    const stateLabel = mongoStateLabel(readyState);
    const name = mongoose.connection.name || null;
    const host = mongoose.connection.host || null;

    let pingOk = false;
    let pingError = null;
    if (readyState === 1 && mongoose.connection.db) {
        try {
            await mongoose.connection.db.admin().command({ ping: 1 });
            pingOk = true;
        } catch (e) {
            pingError = e.message;
        }
    }

    const connected = readyState === 1 && pingOk;
    const body = {
        ok: connected,
        mongo: {
            connected,
            state: readyState,
            stateLabel,
            name,
            host,
            ping: pingOk ? 'ok' : readyState === 1 ? 'failed' : 'skipped',
            ...(pingError ? { pingError } : {})
        }
    };
    res.status(connected ? 200 : 503).json(body);
});

app.use('/img', express.static(path.join(__dirname.split('\src')[0], 'files/images')));
// CheckToken.jwtVerify , checkPermissions,  
app.use('/api/admin', CheckToken.jwtAdminVerify, Sanatize, adminRoutes);
app.use('/api/user', Sanatize, userRoutes);
// Public Twilio webhook (validated via Twilio signature)
app.use('/api/twilio', CheckToken.jwtAdminVerify, Sanatize, whatsappRoutes);
// Authenticated outbound WhatsApp send endpoint

app.use(logErrors)
app.use(clientErrorHandler)

server.listen(PORT, function (err) {
    if (err) {
        console.log(err);
    } else {
        console.log('Server started at : ' + PORT);
    }
});

