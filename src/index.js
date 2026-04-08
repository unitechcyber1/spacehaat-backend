import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
let app = express();
// Required for Twilio webhook signature validation behind ngrok/reverse proxy
app.set('trust proxy', 1);
// import {app as  envapp} from './config/app';
import database from './config/database.js'
import logger from './utilities/logger.js';
import portapp from "./config/app.js"
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
const PORT = portapp.port;
import bodyParser from 'body-parser';
import cors from 'cors';
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
import models from './models/index.js'
import manageEnquiryService from './services/admin/manage-enquiry.js'
import messageService from './utilities/messageService.js';
const WorkSpace = models['WorkSpace'];
import cron from 'node-cron'
import moment from 'moment';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let server = http.Server(app);
initSocket(server);

/*
    Mongoose setup
*/


// mongoose.set('useCreateIndex', true);
// mongoose.set('useFindAndModify', false);
mongoose.connect(database.uri);
mongoose.connection.on('error', logger.error);
mongoose.Promise = global.Promise;

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
// cron.schedule('0 0 * * *', async () => {
//     await updateExpiredDates();
// });
async function updateExpiredDates() {
    try {
        const workspaces = await WorkSpace.find({});
        for (const workspace of workspaces) {
            if (workspace.calendar.length > 0) {
                const updatedCalendar = workspace.calendar.map(entry => {
                    const currentDate = moment().startOf('day');  // Current date (without time)
                    const calendarDate = moment(entry.date).startOf('day');  // Entry date (without time)
                    if (calendarDate.isBefore(currentDate)) {
                        return {
                            date: entry.date,  // Ensure date is preserved
                            status: 'unavailable',
                            seats: entry.seats
                        };
                    }
                    return entry;
                });
                await WorkSpace.findOneAndUpdate(
                    { _id: workspace._id },
                    { calendar: updatedCalendar },
                    { new: true }  // Return the updated document
                );
            }
        }
        console.log('Expired dates successfully updated.');
    } catch (error) {
        console.error('Error updating expired dates:', error);
    }
}

// Virtual Office reminders - First reminder (2 days after lead)
cron.schedule('*/5 11 * * 1-6', async () => {
    try {
        await manageEnquiryService.sendVirtualReminders('first');
    } catch (error) {
        console.error('Virtual first reminder cron failed:', error);
    }
});
cron.schedule('*/5 16 * * 1-6', async () => {
    try {
        await manageEnquiryService.sendVirtualReminders('first');
    } catch (error) {
        console.error('Virtual first reminder cron failed:', error);
    }
});
// Virtual Office reminders - Second, Third, Fourth (4, 7, 11 days after lead)
cron.schedule('*/5 11 * * 1-6', async () => {
    try {
        await manageEnquiryService.sendVirtualReminders('second_and_third');
    } catch (error) {
        console.error('Virtual second/third/fourth reminder cron failed:', error);
    }
});
cron.schedule('*/5 16 * * 1-6', async () => {
    try {
        await manageEnquiryService.sendVirtualReminders('second_and_third');
    } catch (error) {
        console.error('Virtual second/third/fourth reminder cron failed:', error);
    }
});


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
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://cdn.socket.io"],
            connectSrc: cspConnectSrc
        }
    }
}));
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
})

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

