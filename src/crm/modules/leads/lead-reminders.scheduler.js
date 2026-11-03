import { CLOSED_ENQUIRY_STAGES, Lead, toLead } from './leads.model.js';
import { notifyLeadReminder } from '../devices/devices.service.js';

const REMINDER_POLL_MS = 60 * 1000;
const MAX_TIMEOUT_MS = 2_147_483_647;

const pendingTimers = new Map();

function buildLeadTitle(lead) {
    return lead.name || lead.company || 'Lead follow-up';
}

function reminderPendingFilter(now = new Date()) {
    return {
        'assignedUsers.0': { $exists: true },
        reminderSetAt: { $exists: true, $ne: null },
        dueAt: { $lte: now },
        lead_stage: { $nin: CLOSED_ENQUIRY_STAGES },
        $or: [
            { reminderSentAt: null },
            { reminderSentAt: { $exists: false } },
            { $expr: { $ne: ['$reminderSentAt', '$dueAt'] } },
        ],
    };
}

function upcomingReminderFilter(now = new Date()) {
    return {
        'assignedUsers.0': { $exists: true },
        reminderSetAt: { $exists: true, $ne: null },
        dueAt: { $gt: now },
        lead_stage: { $nin: CLOSED_ENQUIRY_STAGES },
        $or: [
            { reminderSentAt: null },
            { reminderSentAt: { $exists: false } },
            { $expr: { $ne: ['$reminderSentAt', '$dueAt'] } },
        ],
    };
}

export function cancelScheduledLeadReminder(leadId) {
    const timer = pendingTimers.get(leadId);
    if (timer) {
        clearTimeout(timer);
        pendingTimers.delete(leadId);
    }
}

async function deliverLeadReminder(lead) {
    if (!lead.assigneeId || !lead.dueAt) return false;

    const leadId = String(lead._id);
    const assigneeId = String(lead.assigneeId);
    const title = buildLeadTitle(lead);

    const sent = await notifyLeadReminder(assigneeId, title, leadId);
    if (!sent) {
        // eslint-disable-next-line no-console
        console.warn(`[reminders] push not delivered for lead ${leadId} (assignee ${assigneeId}) — will retry`);
        return false;
    }

    await Lead.updateOne({ _id: lead._id }, { $set: { reminderSentAt: lead.dueAt } });
    cancelScheduledLeadReminder(leadId);
    return true;
}

export function scheduleLeadReminder(lead) {
    const leadId = String(lead._id);
    cancelScheduledLeadReminder(leadId);

    if (!lead.reminderSetAt || !lead.dueAt || !lead.assigneeId) return;
    if (lead.stage === 'won' || lead.stage === 'lost') return;

    const dueMs = new Date(lead.dueAt).getTime();
    if (Number.isNaN(dueMs)) return;

    const delay = dueMs - Date.now();
    if (delay <= 0) {
        void deliverLeadReminder(lead).catch((err) => {
            // eslint-disable-next-line no-console
            console.error('[reminders] immediate delivery failed', leadId, err);
        });
        return;
    }

    const timer = setTimeout(
        () => {
            pendingTimers.delete(leadId);
            void deliverLeadReminder(lead).catch((err) => {
                // eslint-disable-next-line no-console
                console.error('[reminders] scheduled delivery failed', leadId, err);
            });
        },
        Math.min(delay, MAX_TIMEOUT_MS),
    );

    timer.unref?.();
    pendingTimers.set(leadId, timer);
}

export async function hydrateScheduledLeadReminders() {
    const now = new Date();
    const upcoming = await Lead.find(upcomingReminderFilter(now))
        .select('_id assignedUsers dueAt other_info companyName lead_stage reminderSetAt')
        .sort({ dueAt: 1 })
        .limit(500)
        .lean()
        .exec();

    for (const lead of upcoming) {
        scheduleLeadReminder(toLead(lead));
    }

    if (upcoming.length) {
        // eslint-disable-next-line no-console
        console.log(`[reminders] scheduled ${upcoming.length} upcoming reminder(s)`);
    }
}

export async function processDueLeadReminders() {
    const now = new Date();
    const dueLeads = await Lead.find(reminderPendingFilter(now)).sort({ dueAt: 1 }).limit(50).lean().exec();

    if (!dueLeads.length) return 0;

    let sent = 0;
    for (const lead of dueLeads) {
        const ok = await deliverLeadReminder(toLead(lead));
        if (ok) sent += 1;
    }

    if (sent > 0) {
        // eslint-disable-next-line no-console
        console.log(`[reminders] sent ${sent} lead reminder(s)`);
    }
    return sent;
}

export function startLeadReminderScheduler() {
    const tick = () => {
        void processDueLeadReminders().catch((err) => {
            // eslint-disable-next-line no-console
            console.error('[reminders] scheduler error', err);
        });
    };

    void hydrateScheduledLeadReminders().catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[reminders] hydrate error', err);
    });

    tick();
    const timer = setInterval(tick, REMINDER_POLL_MS);
    timer.unref?.();
    // eslint-disable-next-line no-console
    console.log('[reminders] scheduler started (poll every 60s + exact timers)');
}
