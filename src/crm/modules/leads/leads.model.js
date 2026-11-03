import models from '../../../models/index.js';
import { spaceCodeFromLabel, spaceLabelFromCode } from '../../../models/Enquiry.js';

/** Leads are stored in the Enquiry collection, so the website, admin panel and sales apps share one list. */
export const Lead = models.Enquiry;
export const ClientDirectory = models.ClientDirectory;

export const LEAD_STAGES = [
    'new',
    'cna',
    'cmb',
    'qualified',
    'proposal_sent',
    'visit_scheduled',
    'negotiation',
    'won',
    'lost',
];

export const LEAD_SOURCES = ['smart_match', 'manual', 'referral', 'website', 'whatsapp'];
export const LEAD_PRIORITIES = ['low', 'normal', 'high'];
export const LEAD_INTERESTED_IN = ['Hot desk', 'Dedicated desk', 'Private office', 'Managed office'];

/** Product-line space type on every lead (access + routing). */
export const LEAD_SPACE_TYPES = ['CW', 'VO', 'CL', 'OS'];
export const LEAD_SPACE_TYPE_LABELS = {
    CW: 'Coworking Space',
    VO: 'Virtual Office',
    CL: 'Coliving Space',
    OS: 'Office Space',
};
export const DEFAULT_LEAD_SPACE_TYPE = 'CW';

const ENQUIRY_STAGE = {
    new: 'New',
    cna: 'CNA',
    cmb: 'Call Me Back',
    qualified: 'Interested',
    proposal_sent: 'Proposal Sent',
    visit_scheduled: 'Site Visit Aligned',
    negotiation: 'Agreement Stage',
    won: 'Deal Done',
    lost: 'Lead Lost',
};

const LEAD_STAGE = {
    ...Object.fromEntries(Object.entries(ENQUIRY_STAGE).map(([stage, label]) => [label, stage])),
    'Lead Called': 'qualified',
    'Site Visit Done': 'visit_scheduled',
    'Security Deposited': 'negotiation',
};

const ENQUIRY_SOURCE = {
    smart_match: 'smart_match',
    manual: 'manual',
    referral: 'reference',
    website: 'contactForm',
    whatsapp: 'whatsapp',
};

const LEAD_SOURCE = {
    ...Object.fromEntries(Object.entries(ENQUIRY_SOURCE).map(([source, value]) => [value, source])),
    call: 'manual',
    email: 'manual',
    other: 'manual',
};

export const CLOSED_ENQUIRY_STAGES = [ENQUIRY_STAGE.won, ENQUIRY_STAGE.lost];
export const openLeadFilter = () => ({ lead_stage: { $nin: CLOSED_ENQUIRY_STAGES } });

export const enquiryStage = (stage) => ENQUIRY_STAGE[stage] || ENQUIRY_STAGE.new;
export const enquirySource = (source) => ENQUIRY_SOURCE[source] || ENQUIRY_SOURCE.manual;

/** Every stored stage that the app shows as `stage`. */
export function enquiryStagesFor(stage) {
    return Object.keys(LEAD_STAGE).filter((label) => LEAD_STAGE[label] === stage);
}

export function enquirySourcesFor(source) {
    return Object.keys(LEAD_SOURCE).filter((value) => LEAD_SOURCE[value] === source);
}

const CITY_NAMES = { gurgaon: 'Gurugram', bengaluru: 'Bangalore' };

/** "gurgaon", "new-delhi" -> "Gurugram", "New Delhi". The website and the apps spell cities differently. */
export function canonicalCity(city) {
    const value = String(city || '')
        .trim()
        .replace(/-/g, ' ')
        .toLowerCase();
    if (!value) return '';
    return CITY_NAMES[value] || value.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/** Matches every stored spelling of a city. */
export function cityMatcher(city) {
    const name = canonicalCity(city).toLowerCase();
    const aliases = Object.keys(CITY_NAMES).filter((alias) => CITY_NAMES[alias].toLowerCase() === name);
    const pattern = [name, ...aliases].map((value) => value.replace(/ /g, '[\\s-]')).join('|');
    return new RegExp(`^(${pattern})$`, 'i');
}

function firstNumber(value) {
    const n = Number.parseFloat(String(value ?? '').replace(/[,₹\s]/g, ''));
    return Number.isFinite(n) ? n : 0;
}

/** An enquiry in the shape the sales apps use. Accepts a document or a lean row. */
export function toLead(doc) {
    const row = typeof doc.toObject === 'function' ? doc.toObject({ virtuals: false }) : doc;
    const info = row.other_info || {};
    return {
        _id: row._id,
        leadDate: row.leadDate || row.added_on,
        name: info.name || '',
        contact: info.phone_number || '',
        email: info.email || '',
        company: row.companyName || '',
        interestedIn: row.interestedIn || [],
        spaceType: row.spaceType || spaceCodeFromLabel(row.space_type),
        city: canonicalCity(row.city),
        microlocation: row.microlocation || '',
        seats: row.seats ?? firstNumber(row.no_of_seats),
        seatRange: row.seatRange || '',
        stage: LEAD_STAGE[row.lead_stage] || 'new',
        source: LEAD_SOURCE[row.leadSource] || 'website',
        budget: row.budgetAmount ?? firstNumber(row.budget),
        moveIn: row.moveIn || '',
        rawEnquiry: row.rawEnquiry || row.interested_in || row.note || '',
        amenities: row.amenities || [],
        assigneeId: row.assignedUsers?.[0],
        createdBy: row.createdBy,
        listingIds: row.listingIds || [],
        proposalIds: row.proposalIds || [],
        priority: row.priority || 'normal',
        dueAt: row.dueAt,
        reminderSetAt: row.reminderSetAt,
        lostReason: row.lostReason || '',
        notes: (row.notes || []).map((n) => ({
            text: n.note,
            who: n.who || n.user?.name || 'Team',
            at: n.added_on,
        })),
        createdAt: row.added_on,
        updatedAt: row.updated_on,
    };
}

/** Enquiry fields for the lead values in `input`; keys absent from `input` are left out. */
export function toEnquiryFields(input) {
    const fields = {};
    const assign = (key, target, map = (value) => value) => {
        if (input[key] !== undefined) fields[target] = map(input[key]);
    };

    assign('leadDate', 'leadDate');
    assign('name', 'other_info.name');
    assign('contact', 'other_info.phone_number');
    assign('email', 'other_info.email');
    assign('company', 'companyName');
    assign('city', 'city');
    assign('microlocation', 'microlocation');
    assign('seats', 'seats');
    assign('seats', 'no_of_seats', String);
    assign('seatRange', 'seatRange');
    assign('budget', 'budgetAmount');
    assign('budget', 'budget', String);
    assign('moveIn', 'moveIn');
    assign('rawEnquiry', 'rawEnquiry');
    assign('amenities', 'amenities');
    assign('priority', 'priority');
    assign('lostReason', 'lostReason');
    assign('interestedIn', 'interestedIn');
    assign('interestedIn', 'interested_in', (values) => values.join(', '));
    assign('spaceType', 'spaceType');
    assign('spaceType', 'space_type', spaceLabelFromCode);
    assign('source', 'leadSource', enquirySource);
    assign('stage', 'lead_stage', enquiryStage);
    assign('stage', 'status', (stage) => (stage === 'won' || stage === 'lost' ? 'resolved' : 'in-queue'));
    return fields;
}

/** Sets the owner: first in `assignedUsers`, keeping anyone else with access. */
export function setAssignee(doc, assigneeId) {
    const others = (doc.assignedUsers || []).filter((id) => String(id) !== String(assigneeId));
    doc.assignedUsers = [assigneeId, ...others];
}
