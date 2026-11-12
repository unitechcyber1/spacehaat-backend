import { Types } from 'mongoose';
import { cityScope } from '../auth/permissions.js';
import { countOpenLeads, countOverdueLeads, listOverdueLeads } from '../leads/leads.service.js';
import { WorkSpace, freshOfDays, workspaceQuery } from '../listings/workspace-listings.js';
import { Proposal } from '../proposals/proposals.model.js';

function daysSince(d) {
    const ms = Date.now() - d.getTime();
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function startOfDay(d = new Date()) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function proposalQueryForUser(user) {
    if (user.role === 'admin') return {};
    return { createdBy: new Types.ObjectId(user.id) };
}

async function countProposalsSentBetween(user, from, to) {
    return Proposal.countDocuments({
        ...proposalQueryForUser(user),
        status: 'sent',
        sentAt: { $gte: from, $lt: to },
    });
}

export async function getDashboardStats(user) {
    // Inventory = the website's approved coworking spaces in the user's cities.
    const listingQ = await workspaceQuery({ allowedCities: cityScope(user), liveOnly: true });
    const rows = listingQ ? await WorkSpace.find(listingQ).select('crm_verified_at updated_on added_on createdAt').lean() : [];

    const weekAgo = startOfDay();
    weekAgo.setDate(weekAgo.getDate() - 7);

    let fresh = 0;
    let stale = 0;
    let expired = 0;
    let addedThisWeek = 0;

    for (const row of rows) {
        const checked = row.crm_verified_at || row.updated_on || row.added_on || row.createdAt || row._id.getTimestamp();
        const days = checked ? daysSince(new Date(checked)) : 999;
        const state = freshOfDays(days).state;
        if (state === 'fresh') fresh += 1;
        else if (state === 'stale') stale += 1;
        else expired += 1;

        const added = row.added_on || row.createdAt || row._id.getTimestamp();
        if (new Date(added) >= weekAgo) addedThisWeek += 1;
    }

    const total = rows.length;
    const freshPct = total ? Math.round((fresh / total) * 100) : 0;

    const todayStart = startOfDay();
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const [sentToday, sentYesterday, sentThisWeek, generatedTotal, openLeads, overdueLeads, overdueLeadItems] =
        await Promise.all([
            countProposalsSentBetween(user, todayStart, tomorrowStart),
            countProposalsSentBetween(user, yesterdayStart, todayStart),
            Proposal.countDocuments({
                ...proposalQueryForUser(user),
                status: 'sent',
                sentAt: { $gte: weekAgo },
            }),
            Proposal.countDocuments({
                ...proposalQueryForUser(user),
                status: { $in: ['sent', 'generated'] },
            }),
            countOpenLeads(user),
            countOverdueLeads(user),
            listOverdueLeads(user, 5),
        ]);

    const proposalsDelta = sentToday - sentYesterday;

    return {
        listings: {
            total,
            fresh,
            stale,
            expired,
            needsReverify: stale + expired,
            addedThisWeek,
            freshPct,
        },
        proposals: {
            sentToday,
            sentYesterday,
            sentThisWeek,
            generatedTotal,
            deltaVsYesterday: proposalsDelta,
        },
        leads: {
            open: openLeads,
            overdue: overdueLeads,
        },
        attention: {
            staleListings: stale + expired,
            expiredListings: expired,
            overdueLeads: overdueLeadItems,
        },
    };
}
