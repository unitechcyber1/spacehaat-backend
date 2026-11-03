import { Types } from 'mongoose';

import { User, activeStaffFilter } from '../users/users.model.js';
import { Device } from './devices.model.js';
import { CLOSED_ENQUIRY_STAGES, Lead, toLead } from '../leads/leads.model.js';
import { env } from '../../config/env.js';

async function sendExpoPush(tokens, message) {
    if (!env.NOTIFICATIONS_ENABLED || !tokens.length) return false;

    const chunks = [];
    for (let i = 0; i < tokens.length; i += 100) {
        chunks.push(tokens.slice(i, i + 100));
    }

    let delivered = false;

    await Promise.all(
        chunks.map(async (batch) => {
            const res = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(
                    batch.map((to) => ({
                        to,
                        sound: 'default',
                        title: message.title,
                        body: message.body,
                        channelId: 'default',
                        priority: 'high',
                        data: message.data || {},
                    })),
                ),
            });
            const json = await res.json().catch(() => null);

            const staleTokens = [];
            if (json?.data) {
                json.data.forEach((item, index) => {
                    if (item.status === 'ok') delivered = true;
                    if (item.status === 'error') {
                        // eslint-disable-next-line no-console
                        console.error('[push] Expo send error:', item.message, item.details);
                        if (item.details?.error === 'DeviceNotRegistered' && batch[index]) {
                            staleTokens.push(batch[index]);
                        }
                    }
                });
            } else if (res.ok) {
                delivered = true;
            }

            if (staleTokens.length) {
                await Device.deleteMany({ token: { $in: staleTokens } });
                // eslint-disable-next-line no-console
                console.warn(`[push] removed ${staleTokens.length} stale device token(s)`);
            }
        }),
    );

    return delivered;
}

export async function registerDevice(input, user) {
    await Device.findOneAndUpdate(
        { token: input.token },
        {
            userId: new Types.ObjectId(user.id),
            token: input.token,
            platform: input.platform,
            lastSeenAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
    );
}

export async function unregisterDevice(token, user) {
    await Device.deleteOne({ token, userId: new Types.ObjectId(user.id) });
}

async function tokensForUser(userId) {
    const docs = await Device.find({ userId: new Types.ObjectId(userId) })
        .select('token')
        .lean();
    return docs.map((d) => d.token).filter(Boolean);
}

export async function notifyUser(userId, message) {
    const tokens = await tokensForUser(userId);
    if (!tokens.length) {
        // eslint-disable-next-line no-console
        console.warn(`[push] no registered devices for user ${userId} — skip "${message.title}"`);
        return false;
    }
    return sendExpoPush(tokens, message);
}

export async function notifyLeadAssigned(assigneeId, leadTitle, leadId) {
    await notifyUser(assigneeId, {
        title: 'New lead assigned',
        body: leadTitle,
        data: { type: 'lead_assigned', leadId },
    });
}

/**
 * Notify about a newly created lead.
 * Only the assignee is notified (not every member who shares the city).
 * Excludes the creator (e.g. admin who added the lead).
 */
export async function notifyMembersOfNewLead(input) {
    const { leadId, leadTitle, city, excludeUserId, assigneeId } = input;

    if (!assigneeId || assigneeId === excludeUserId || !Types.ObjectId.isValid(assigneeId)) {
        return;
    }

    const assignee = await User.findOne({ _id: assigneeId, ...activeStaffFilter })
        .select('_id role')
        .lean()
        .exec();
    if (!assignee) return;

    await notifyUser(String(assignee._id), {
        title: 'New lead assigned',
        body: city ? `${leadTitle} · ${city}` : leadTitle,
        data: {
            type: 'lead_assigned',
            leadId,
        },
    });
}

export async function notifyLeadReminder(assigneeId, leadTitle, leadId) {
    return notifyUser(assigneeId, {
        title: 'Lead follow-up due',
        body: leadTitle,
        data: { type: 'lead_reminder', leadId },
    });
}

export async function notifyOverdueLeads(userId) {
    const now = new Date();
    const overdue = await Lead.find({
        'assignedUsers.0': new Types.ObjectId(userId),
        reminderSetAt: { $exists: true, $ne: null },
        dueAt: { $lt: now },
        lead_stage: { $nin: CLOSED_ENQUIRY_STAGES },
    })
        .sort({ dueAt: 1 })
        .limit(5)
        .lean();

    if (!overdue.length) return;

    const first = toLead(overdue[0]);
    const count = overdue.length;
    const title = count === 1 ? 'Follow-up overdue' : `${count} follow-ups overdue`;
    const body =
        count === 1
            ? `${first.name || first.company || 'Lead'} needs attention`
            : `Including ${first.name || first.company || 'a lead'} — tap to review`;

    await notifyUser(userId, {
        title,
        body,
        data: {
            type: 'follow_up_overdue',
            leadId: String(first._id),
        },
    });
}
