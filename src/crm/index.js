import express from 'express';
import helmet from 'helmet';
import { corsMiddleware } from '../config/corsOptions.js';
import { errorMiddleware } from './middleware/error.js';
import { Router } from './utils/router.js';
import { env } from './config/env.js';
import { requireAuth } from './modules/auth/auth.middleware.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { listingsRouter } from './modules/listings/listings.routes.js';
import { uploadsRouter } from './modules/uploads/uploads.routes.js';
import { proposalsRouter, publicProposalsRouter } from './modules/proposals/proposals.routes.js';
import { smartMatchRouter } from './modules/smart-match/smart-match.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { leadsRouter } from './modules/leads/leads.routes.js';
import { devicesRouter } from './modules/devices/devices.routes.js';
import { startLeadReminderScheduler } from './modules/leads/lead-reminders.scheduler.js';
import { backfillEnquiries } from './modules/leads/leads.backfill.js';
import { Lead } from './modules/leads/leads.model.js';

export const crmEnabled = Boolean(env.JWT_SECRET);

/**
 * The sales CRM API, mounted at /api/v1. Has its own parsers, so mount it before the main
 * app's express-fileupload, which would consume the multipart bodies multer needs here.
 */
export function createCrmRouter() {
    const router = Router();

    router.use(corsMiddleware());
    router.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
    router.use(express.json({ limit: '2mb' }));

    // Public: health + auth (login/logout). /auth/me self-guards.
    router.use(healthRouter);
    router.use(authRouter);
    router.use(publicProposalsRouter);

    // Admin-only user management (router self-guards with requireAuth + permission).
    router.use(usersRouter);

    // Everything below requires a valid session. Fine-grained permissions + scoping are enforced per route.
    router.use(requireAuth, listingsRouter);
    router.use(requireAuth, uploadsRouter);
    router.use(requireAuth, proposalsRouter);
    router.use(requireAuth, smartMatchRouter);
    router.use(requireAuth, dashboardRouter);
    router.use(requireAuth, leadsRouter);
    router.use(requireAuth, devicesRouter);

    router.use(errorMiddleware);
    return router;
}

export function startCrmBackgroundJobs() {
    if (!env.NOTIFICATIONS_ENABLED) return;
    // Under PM2 cluster mode, only one worker may run these or staff get duplicate reminders.
    if (process.env.NODE_APP_INSTANCE && process.env.NODE_APP_INSTANCE !== '0') return;

    backfillEnquiries(Lead.db.db.collection(Lead.collection.name)).catch((err) =>
        console.error('[CRM] enquiry backfill failed', err),
    );
    startLeadReminderScheduler();
}
