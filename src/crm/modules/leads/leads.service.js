import { Types } from 'mongoose';
import { ApiError } from '../../utils/apiError.js';
import { Activity } from '../activity/activity.model.js';
import { cityScope, hasPermission, isAdmin, PERMISSIONS, spaceTypeScope } from '../auth/permissions.js';
import {
    ClientDirectory,
    DEFAULT_LEAD_SPACE_TYPE,
    LEAD_INTERESTED_IN,
    LEAD_SPACE_TYPES,
    Lead,
    cityMatcher,
    enquirySourcesFor,
    enquiryStagesFor,
    openLeadFilter,
    setAssignee,
    toEnquiryFields,
    toLead,
} from './leads.model.js';
import { parseLeadFromText } from './leads.parser.js';
import { buildLeadSearchFilter } from './leads.search.js';
import { assertAssigneeEligible, attachAssigneeNames, listLeadAssignees, resolveLeadAssignee } from './leads.assign.js';
import { buildParseContext } from '../smart-match/smart-match.service.js';
import { listListings } from '../listings/listings.service.js';
import { notifyLeadAssigned, notifyMembersOfNewLead } from '../devices/devices.service.js';
import { scheduleLeadReminder } from './lead-reminders.scheduler.js';

const INTERESTED_IN_SET = new Set(LEAD_INTERESTED_IN);

function mapSpaceTypeToInterestedIn(value) {
    const v = value.trim();
    if (!v) return null;
    if (INTERESTED_IN_SET.has(v)) return v;
    if (v === 'Private cabin') return 'Private office';
    return null;
}

function mapSpaceTypes(values = []) {
    const out = [];
    for (const v of values) {
        const mapped = mapSpaceTypeToInterestedIn(v);
        if (mapped && !out.includes(mapped)) out.push(mapped);
    }
    return out;
}

/** `{ 'other_info.name': x }` -> `{ other_info: { name: x } }`, for constructing a new document. */
function expandDottedFields(fields) {
    const out = {};
    for (const [key, value] of Object.entries(fields)) {
        const [head, tail] = key.split('.');
        if (tail) out[head] = { ...out[head], [tail]: value };
        else out[key] = value;
    }
    return out;
}

function seatDisplayLabel(lead) {
    if (lead.seatRange?.trim()) return `${lead.seatRange.trim()} seats`;
    if (lead.seats) return `${lead.seats} seats`;
    return '';
}

function buildDisplayTitle(lead) {
    const who = lead.company || lead.name || 'New lead';
    const seats = seatDisplayLabel(lead);
    const place = lead.microlocation || lead.city || '';
    const parts = [who, [seats, place].filter(Boolean).join(' · ')].filter(Boolean);
    return parts.join(' — ').slice(0, 200);
}

function activeReminderFilter() {
    return { reminderSetAt: { $exists: true, $ne: null } };
}

function upcomingReminderFilter(now = new Date()) {
    return {
        ...activeReminderFilter(),
        dueAt: { $gte: now },
    };
}

const STAGE_ACTIVITY_LABEL = {
    cna: 'call not attend',
    cmb: 'call me back',
};

async function logLeadActivity(who, text, sub) {
    await Activity.create({ kind: 'lead', who, text, sub });
}

async function upsertClientDirectory(client, actorId) {
    const name = client.name?.trim() || '';
    const company = client.company?.trim() || '';
    if (!name && !company) return;

    const q = { createdBy: new Types.ObjectId(actorId) };
    if (company) q.company = company;
    else q.name = name;

    await ClientDirectory.findOneAndUpdate(
        q,
        {
            $set: {
                name,
                company,
                email: client.email || '',
                phone: client.contact || client.phone || '',
                lastContactAt: new Date(),
            },
            $inc: { leadCount: 1 },
            $setOnInsert: { createdBy: new Types.ObjectId(actorId), wonCount: 0 },
        },
        { upsert: true, new: true },
    ).exec();
}

function leadQueryForUser(user) {
    if (isAdmin(user)) return {};
    // Members only see leads assigned to them (or that they created).
    // Shared city access does NOT grant visibility to another user's leads.
    const id = new Types.ObjectId(user.id);
    return { $or: [{ assignedUsers: id }, { createdBy: id }] };
}

function combineFilters(...filters) {
    const parts = filters.filter((f) => Object.keys(f).length > 0);
    if (!parts.length) return {};
    if (parts.length === 1) return parts[0];
    return { $and: parts };
}

function asLeadFilter(q) {
    return q;
}

function cityFilterForUser(user, city) {
    const scope = cityScope(user);
    if (scope !== null) {
        if (!scope.length) return { city: { $in: [] } };
        return { city: { $in: scope.map(cityMatcher) } };
    }
    if (city && city !== 'All cities') return { city: cityMatcher(city) };
    return {};
}

function spaceTypeFilterForUser(user, spaceType) {
    const scope = spaceTypeScope(user);
    if (scope !== null) {
        // Include legacy leads with no spaceType as CW
        return {
            $or: [
                { spaceType: { $in: scope } },
                ...(scope.includes('CW')
                    ? [{ spaceType: { $exists: false } }, { spaceType: null }, { spaceType: '' }]
                    : []),
            ],
        };
    }
    if (spaceType && LEAD_SPACE_TYPES.includes(spaceType)) {
        return { spaceType };
    }
    return {};
}

function parseLeadDateBound(value, endExclusive = false) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

function leadDateFilter(dateFrom, dateTo) {
    const from = parseLeadDateBound(dateFrom);
    const to = parseLeadDateBound(dateTo);
    if (!from && !to) return {};

    const range = {};
    if (from) range.$gte = from;
    if (to) range.$lt = to;

    return {
        $or: [
            { leadDate: range },
            { $and: [{ $or: [{ leadDate: { $exists: false } }, { leadDate: null }] }, { added_on: range }] },
        ],
    };
}

function buildLeadListFilters(actor, options) {
    const filters = [
        leadQueryForUser(actor),
        cityFilterForUser(actor, options.city),
        spaceTypeFilterForUser(actor, options.spaceType),
    ];

    if (options.assignee) {
        filters.push({ 'assignedUsers.0': new Types.ObjectId(options.assignee) });
    }
    if (options.source) {
        filters.push({ leadSource: { $in: enquirySourcesFor(options.source) } });
    }

    const dateRange = leadDateFilter(options.dateFrom, options.dateTo);
    if (Object.keys(dateRange).length) filters.push(dateRange);

    return filters;
}

async function aggregateLeadStageCounts(q) {
    const rows = await Lead.aggregate([
        { $match: q },
        { $group: { _id: { $ifNull: ['$lead_stage', 'New'] }, count: { $sum: 1 } } },
    ]).exec();

    const stageCounts = {};
    for (const row of rows) {
        const { stage } = toLead({ lead_stage: row._id });
        stageCounts[stage] = (stageCounts[stage] || 0) + row.count;
    }
    return stageCounts;
}

function leadSummary(lead) {
    return {
        id: String(lead._id),
        displayTitle: buildDisplayTitle(lead),
        leadDate: lead.leadDate || lead.createdAt || null,
        name: lead.name || '',
        contact: lead.contact || '',
        email: lead.email || '',
        company: lead.company || '',
        interestedIn: lead.interestedIn || [],
        spaceType: lead.spaceType || DEFAULT_LEAD_SPACE_TYPE,
        city: lead.city || '',
        microlocation: lead.microlocation || '',
        seats: lead.seats || 0,
        seatRange: lead.seatRange || '',
        stage: lead.stage || 'new',
        source: lead.source || 'manual',
        budget: lead.budget || 0,
        moveIn: lead.moveIn || '',
        priority: lead.priority || 'normal',
        listingCount: lead.listingIds?.length || 0,
        proposalCount: lead.proposalIds?.length || 0,
        assigneeId: lead.assigneeId ? String(lead.assigneeId) : '',
        dueAt: lead.dueAt || null,
        reminderSetAt: lead.reminderSetAt || null,
        createdAt: lead.createdAt || null,
        updatedAt: lead.updatedAt || null,
    };
}

function toLeadSummary(doc) {
    return leadSummary(toLead(doc));
}

function toLeadDetail(doc) {
    const lead = toLead(doc);
    const { notes } = lead;
    const timeline = [
        ...notes.map((n) => ({
            kind: 'note',
            who: n.who,
            text: n.text,
            at: n.at,
        })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return {
        ...leadSummary(lead),
        rawEnquiry: lead.rawEnquiry || '',
        amenities: lead.amenities || [],
        listingIds: (lead.listingIds || []).map((id) => String(id)),
        proposalIds: (lead.proposalIds || []).map((id) => String(id)),
        lostReason: lead.lostReason || '',
        notes,
        timeline,
    };
}

async function getLeadDoc(id, actor) {
    const doc = await Lead.findById(id).populate('notes.user', 'name').exec();
    if (!doc) throw new ApiError(404, 'Lead not found', 'NOT_FOUND');
    if (!isAdmin(actor)) {
        const owner = String(doc.createdBy) === actor.id;
        const assigned = (doc.assignedUsers || []).some((userId) => String(userId) === actor.id);
        if (!owner && !assigned) {
            throw new ApiError(403, 'You do not have access to this lead', 'FORBIDDEN');
        }
    }
    return doc;
}

export async function listLeads(actor, options = {}) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const skip = (page - 1) * limit;

    const stageFilter = options.stage || options.status;
    const baseFilters = buildLeadListFilters(actor, {
        assignee: options.assignee,
        city: options.city,
        spaceType: options.spaceType,
        source: options.source,
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
    });

    const search = options.search?.trim();
    let searchFilter = {};
    if (search) {
        searchFilter = (await buildLeadSearchFilter(search)) || {};
    }

    const listFilters = [...baseFilters];
    if (stageFilter) {
        listFilters.push({ lead_stage: { $in: enquiryStagesFor(stageFilter) } });
    }
    if (Object.keys(searchFilter).length) listFilters.push(searchFilter);
    if (options.reminder === 'upcoming') {
        listFilters.push(upcomingReminderFilter());
        listFilters.push(openLeadFilter());
    }

    const q = asLeadFilter(combineFilters(...listFilters));
    const countBaseFilters = [...baseFilters];
    if (Object.keys(searchFilter).length) countBaseFilters.push(searchFilter);
    const countBaseQ = asLeadFilter(combineFilters(...countBaseFilters));

    const [rawRows, total, stageCounts] = await Promise.all([
        Lead.find(q).sort({ leadDate: -1, updated_on: -1 }).skip(skip).limit(limit).lean().exec(),
        Lead.countDocuments(q),
        aggregateLeadStageCounts(countBaseQ),
    ]);
    const rows = rawRows;

    return {
        items: await attachAssigneeNames(rows.map((doc) => toLeadSummary(doc))),
        total,
        stageCounts,
        page,
        limit,
        pageCount: Math.max(1, Math.ceil(total / limit)),
    };
}

export async function createLead(input, actor) {
    const city = input.city || '';
    const spaceType = input.spaceType || DEFAULT_LEAD_SPACE_TYPE;

    const memberTypes = spaceTypeScope(actor);
    if (memberTypes && !memberTypes.includes(spaceType)) {
        throw new ApiError(403, `You are not scoped to space type ${spaceType}`, 'FORBIDDEN');
    }

    const assigneeId = await resolveLeadAssignee(city, actor, input.assigneeId || null, spaceType);

    const listingIds = (input.listingIds || [])
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));

    const doc = new Lead({
        ...expandDottedFields(
            toEnquiryFields({
                leadDate: input.leadDate ? new Date(input.leadDate) : new Date(),
                name: input.name || '',
                contact: input.contact || '',
                email: input.email || '',
                company: input.company || '',
                interestedIn: input.interestedIn || [],
                spaceType,
                city: input.city || '',
                microlocation: input.microlocation || '',
                seats: input.seats || 0,
                seatRange: input.seatRange || '',
                stage: input.stage || 'new',
                source: input.source || 'manual',
                budget: input.budget || 0,
                moveIn: input.moveIn || '',
                rawEnquiry: input.rawEnquiry || '',
                amenities: input.amenities || [],
                priority: input.priority || 'normal',
            }),
        ),
        lead_id: `CRM${Date.now().toString(36).toUpperCase()}`,
        assignedUsers: [new Types.ObjectId(assigneeId)],
        createdBy: new Types.ObjectId(actor.id),
        listingIds,
        proposalIds: [],
        visitIds: [],
        dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        notes: [],
    });
    await doc.save();

    const lead = toLead(doc);
    await upsertClientDirectory(lead, actor.id);
    const title = buildDisplayTitle(lead);
    await logLeadActivity(actor.name, 'created a lead', title);

    // Notify city members; never notify the person who created the lead (e.g. admin).
    void notifyMembersOfNewLead({
        leadId: String(doc._id),
        leadTitle: title,
        city,
        excludeUserId: actor.id,
        assigneeId,
    });

    const [item] = await attachAssigneeNames([toLeadDetail(doc)]);
    return item;
}

export async function createLeadFromMatch(input, actor) {
    const client = input.client ?? { name: '', company: '', email: '', phone: '' };
    const interestedIn = input.interestedIn?.length ? input.interestedIn : mapSpaceTypes(input.spaceTypes || []);

    return createLead(
        {
            source: 'smart_match',
            name: input.name || client.name || '',
            contact: input.contact || client.phone || '',
            email: input.email || client.email || '',
            company: input.company || client.company || '',
            city: input.city || '',
            microlocation: input.microlocation || input.locality || '',
            seats: input.seats ?? input.teamSize ?? 0,
            seatRange: '',
            budget: input.budget ?? input.budgetPerSeat ?? 0,
            moveIn: input.moveIn || '',
            amenities: input.amenities || [],
            interestedIn,
            spaceType: input.spaceType || DEFAULT_LEAD_SPACE_TYPE,
            rawEnquiry: input.enquiry || '',
            listingIds: input.listingIds,
            assigneeId: input.assigneeId,
        },
        actor,
    );
}

export async function parseLeadPaste(enquiry, actor) {
    const allowed = cityScope(actor);
    const { items } = await listListings({ allowedCities: allowed });
    const ctx = buildParseContext(items);
    const { fields, source } = await parseLeadFromText(enquiry, ctx);
    return { fields, source };
}

export async function getLeadAssignees(city, actor, spaceType) {
    return listLeadAssignees(city, actor, spaceType);
}

export async function getLead(id, actor) {
    const doc = await getLeadDoc(id, actor);
    const [item] = await attachAssigneeNames([toLeadDetail(doc)]);
    return item;
}

export async function deleteLead(id, actor) {
    const doc = await getLeadDoc(id, actor);
    const title = buildDisplayTitle(toLead(doc));
    await doc.deleteOne();
    await logLeadActivity(actor.name, 'deleted lead', title);
    return { id: String(doc._id), deleted: true };
}

export async function updateLead(id, input, actor) {
    const doc = await getLeadDoc(id, actor);
    const before = toLead(doc);
    const prevAssigneeId = before.assigneeId ? String(before.assigneeId) : '';

    if (input.assigneeId !== undefined) {
        if (!hasPermission(actor, PERMISSIONS.LEADS_ASSIGN) && !isAdmin(actor)) {
            throw new ApiError(403, 'You cannot reassign leads', 'FORBIDDEN');
        }
        const nextSpaceType = input.spaceType || before.spaceType || DEFAULT_LEAD_SPACE_TYPE;
        if (input.assigneeId) {
            await assertAssigneeEligible(input.assigneeId, before.city, nextSpaceType);
            setAssignee(doc, new Types.ObjectId(input.assigneeId));
        } else {
            const autoId = await resolveLeadAssignee(before.city, actor, null, nextSpaceType);
            setAssignee(doc, new Types.ObjectId(autoId));
        }
    }

    if (input.spaceType !== undefined) {
        const memberTypes = spaceTypeScope(actor);
        if (memberTypes && !memberTypes.includes(input.spaceType)) {
            throw new ApiError(403, `You are not scoped to space type ${input.spaceType}`, 'FORBIDDEN');
        }
    }

    const leadDate = input.leadDate === undefined ? undefined : input.leadDate ? new Date(input.leadDate) : new Date();
    doc.set(toEnquiryFields({ ...input, leadDate }));

    if (input.dueAt !== undefined) {
        const nextDue = input.dueAt ? new Date(input.dueAt) : undefined;
        const prevDueMs = doc.dueAt ? new Date(doc.dueAt).getTime() : null;
        const nextDueMs = nextDue ? nextDue.getTime() : null;
        doc.dueAt = nextDue;
        if (prevDueMs !== nextDueMs) {
            doc.reminderSentAt = undefined;
            doc.reminderSetAt = undefined;
        }
    }
    if (input.listingIds) {
        doc.listingIds = input.listingIds.filter((x) => Types.ObjectId.isValid(x)).map((x) => new Types.ObjectId(x));
    }

    await doc.save();

    const updated = toLead(doc);
    const title = buildDisplayTitle(updated);
    if (
        input.name !== undefined ||
        input.email !== undefined ||
        input.contact !== undefined ||
        input.company !== undefined
    ) {
        await upsertClientDirectory(updated, actor.id);
    }
    if (input.stage && input.stage !== before.stage) {
        const stageLabel = STAGE_ACTIVITY_LABEL[input.stage] || input.stage.replace(/_/g, ' ');
        await logLeadActivity(actor.name, `moved lead to ${stageLabel}`, title);
    }
    if (input.assigneeId !== undefined) {
        await logLeadActivity(actor.name, 'updated lead assignment', title);
        const newAssigneeId = String(updated.assigneeId);
        if (newAssigneeId && newAssigneeId !== prevAssigneeId && newAssigneeId !== actor.id) {
            void notifyLeadAssigned(newAssigneeId, title, String(doc._id));
        }
    }

    const [item] = await attachAssigneeNames([toLeadDetail(doc)]);
    return item;
}

export async function setLeadReminder(id, input, actor) {
    const doc = await getLeadDoc(id, actor);
    const dueAt = new Date(input.dueAt);
    if (Number.isNaN(dueAt.getTime())) {
        throw new ApiError(400, 'Invalid reminder date', 'VALIDATION_ERROR');
    }

    doc.dueAt = dueAt;
    doc.reminderSetAt = new Date();
    doc.reminderSentAt = undefined;

    const note = input.note?.trim();
    if (note) {
        doc.notes.push({ note, who: actor.name, user: actor.id, added_on: new Date() });
    }

    await doc.save();
    const lead = toLead(doc);
    await logLeadActivity(actor.name, 'set a follow-up reminder on', buildDisplayTitle(lead));

    scheduleLeadReminder(lead);

    const [item] = await attachAssigneeNames([toLeadDetail(doc)]);
    return item;
}

export async function addLeadNote(id, text, actor) {
    const doc = await getLeadDoc(id, actor);
    doc.notes.push({ note: text, who: actor.name, user: actor.id, added_on: new Date() });
    await doc.save();
    await logLeadActivity(actor.name, 'added a note on', buildDisplayTitle(toLead(doc)));
    const [item] = await attachAssigneeNames([toLeadDetail(doc)]);
    return item;
}

export async function attachProposalToLead(leadId, proposalId, actor) {
    if (!Types.ObjectId.isValid(leadId) || !Types.ObjectId.isValid(proposalId)) return null;
    const doc = await getLeadDoc(leadId, actor);
    const pid = new Types.ObjectId(proposalId);
    const exists = (doc.proposalIds || []).some((id) => String(id) === proposalId);
    if (!exists) doc.proposalIds.push(pid);
    const { stage } = toLead(doc);
    if (stage === 'new' || stage === 'qualified') doc.set(toEnquiryFields({ stage: 'proposal_sent' }));
    await doc.save();
    await logLeadActivity(actor.name, 'linked a proposal to', buildDisplayTitle(toLead(doc)));
    const [item] = await attachAssigneeNames([toLeadSummary(doc)]);
    return item;
}

/** Called from the public client portal when a visit is requested. */
export async function advanceLeadOnClientVisit(leadId) {
    if (!leadId || !Types.ObjectId.isValid(String(leadId))) return null;
    const doc = await Lead.findById(leadId).exec();
    if (!doc) return null;
    const { stage } = toLead(doc);
    if (stage === 'won' || stage === 'lost' || stage === 'visit_scheduled') return doc;
    doc.set(toEnquiryFields({ stage: 'visit_scheduled' }));
    await doc.save();
    const title = buildDisplayTitle(toLead(doc));
    await logLeadActivity('Client', 'requested a visit via proposal portal', title);
    return doc;
}

export async function listClients(actor, search = '') {
    const q = {};
    if (!isAdmin(actor)) q.createdBy = new Types.ObjectId(actor.id);
    if (search.trim()) {
        const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(escaped, 'i');
        q.$or = [{ name: re }, { company: re }, { email: re }];
    }
    const rows = await ClientDirectory.find(q).sort({ lastContactAt: -1 }).limit(100).lean().exec();
    return rows.map((c) => ({
        id: String(c._id),
        name: c.name || '',
        company: c.company || '',
        email: c.email || '',
        phone: c.phone || '',
        leadCount: c.leadCount || 0,
        wonCount: c.wonCount || 0,
        lastContactAt: c.lastContactAt || null,
    }));
}

export async function listRecentClients(actor, limit = 10) {
    const q = {};
    if (!isAdmin(actor)) q.createdBy = new Types.ObjectId(actor.id);
    const rows = await ClientDirectory.find(q).sort({ lastContactAt: -1 }).limit(limit).lean().exec();
    return rows.map((c) => ({
        id: String(c._id),
        name: c.name || '',
        company: c.company || '',
        email: c.email || '',
        phone: c.phone || '',
    }));
}

export async function countOverdueLeads(actor) {
    const q = asLeadFilter(
        combineFilters(leadQueryForUser(actor), cityFilterForUser(actor), {
            ...activeReminderFilter(),
            dueAt: { $lt: new Date() },
            ...openLeadFilter(),
        }),
    );
    return Lead.countDocuments(q);
}

export async function listOverdueLeads(actor, limit = 5) {
    const q = asLeadFilter(
        combineFilters(leadQueryForUser(actor), cityFilterForUser(actor), {
            ...activeReminderFilter(),
            dueAt: { $lt: new Date() },
            ...openLeadFilter(),
        }),
    );
    const rawRows = await Lead.find(q).sort({ dueAt: 1 }).limit(limit).lean().exec();
    const rows = rawRows;
    return rows.map((doc) => toLeadSummary(doc));
}

export async function countOpenLeads(actor) {
    const q = asLeadFilter(combineFilters(leadQueryForUser(actor), cityFilterForUser(actor), openLeadFilter()));
    return Lead.countDocuments(q);
}
