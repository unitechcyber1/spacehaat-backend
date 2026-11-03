import { Types } from 'mongoose';
import { LEAD_SOURCES, LEAD_STAGES, enquirySourcesFor, enquiryStagesFor } from './leads.model.js';
import { User, activeStaffFilter } from '../users/users.model.js';

const STAGE_LABELS = {
    new: 'new',
    qualified: 'qualified',
    proposal_sent: 'proposal sent',
    visit_scheduled: 'visit scheduled',
    negotiation: 'negotiation',
    won: 'won',
    lost: 'lost',
};

const SOURCE_LABELS = {
    smart_match: 'smart match',
    manual: 'manual',
    referral: 'referral',
    website: 'website',
    whatsapp: 'whatsapp',
};

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stageMatches(search) {
    const lower = search.toLowerCase().trim();
    const normalized = lower.replace(/\s+/g, '_');
    const hits = new Set();

    for (const stage of LEAD_STAGES) {
        if (stage.includes(normalized) || normalized.includes(stage)) hits.add(stage);
        const label = STAGE_LABELS[stage] || stage;
        if (label.includes(lower) || lower.includes(label.replace(/_/g, ' '))) hits.add(stage);
    }
    return [...hits];
}

function sourceMatches(search) {
    const lower = search.toLowerCase().trim();
    const hits = new Set();

    for (const source of LEAD_SOURCES) {
        if (source.includes(lower.replace(/\s+/g, '_')) || lower.includes(source.replace(/_/g, ' '))) {
            hits.add(source);
        }
        const label = SOURCE_LABELS[source] || source;
        if (label.includes(lower) || lower.includes(label)) hits.add(source);
    }
    return [...hits];
}

export async function buildLeadSearchFilter(search) {
    const trimmed = search.trim();
    if (!trimmed) return null;

    const escaped = escapeRegex(trimmed);
    const re = new RegExp(escaped, 'i');
    const or = [
        { 'other_info.name': re },
        { companyName: re },
        { 'other_info.email': re },
        { 'other_info.phone_number': re },
        { city: re },
        { microlocation: re },
        { moveIn: re },
        { rawEnquiry: re },
        { interested_in: re },
        { interestedIn: re },
        { leadSource: re },
        { lead_stage: re },
    ];

    for (const stage of stageMatches(trimmed)) {
        or.push({ lead_stage: { $in: enquiryStagesFor(stage) } });
    }

    for (const source of sourceMatches(trimmed)) {
        or.push({ leadSource: { $in: enquirySourcesFor(source) } });
    }

    const numeric = Number(trimmed.replace(/[,₹\s]/g, ''));
    if (Number.isFinite(numeric) && numeric > 0) {
        or.push({ seats: numeric }, { budgetAmount: numeric });
    }

    const assignees = await User.find({ ...activeStaffFilter, $or: [{ name: re }, { email: re }] })
        .select('_id')
        .lean()
        .exec();

    if (assignees.length) {
        or.push({ 'assignedUsers.0': { $in: assignees.map((u) => u._id) } });
    }

    if (Types.ObjectId.isValid(trimmed) && trimmed.length === 24) {
        or.push({ _id: new Types.ObjectId(trimmed) });
    }

    return { $or: or };
}
