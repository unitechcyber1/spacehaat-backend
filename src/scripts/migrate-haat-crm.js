/**
 * Copies the sales CRM data from the haat-backend database into this one.
 *
 *   users            Staff are merged: matched by email or phone, otherwise inserted with their
 *                    original _id so existing app logins keep working.
 *   leads            Become Enquiry documents, keeping their _id. Lead numbers that already exist
 *                    as a website enquiry are not merged: both stay, as they are separate records.
 *   listings, proposals, activities, clientdirectories, devices, refreshtokens
 *                    Copied as they are, with user ids remapped for merged staff.
 *
 * Existing website enquiries are backfilled with the CRM fields (spaceType, leadDate).
 * Every write is by _id and nothing is deleted. Leads, listings and proposals created here keep their
 * own ids and are not touched, and staff already added here are matched by email. Once a migrated lead
 * has been edited here, do not run this again: it replaces each lead with the haat-backend copy.
 *
 * Usage:
 *   HAAT_MONGODB_URI=... node src/scripts/migrate-haat-crm.js            Preview, no writes.
 *   HAAT_MONGODB_URI=... node src/scripts/migrate-haat-crm.js --apply    Write.
 */
import '../config/loadEnv.js';
import mongoose from 'mongoose';
import database from '../config/database.js';
import { spaceLabelFromCode } from '../models/Enquiry.js';
import { backfillEnquiries } from '../crm/modules/leads/leads.backfill.js';
import { enquirySource, enquiryStage } from '../crm/modules/leads/leads.model.js';

const apply = process.argv.includes('--apply');
const BATCH = 500;
const SALES_ROLE = 'sales';

const phoneKey = (value) => String(value || '').replace(/\D/g, '').slice(-10);
const emailKey = (value) => String(value || '').trim().toLowerCase();

function remapUser(id, idMap) {
    if (!id) return id;
    return idMap.get(String(id)) || id;
}

async function mergeUsers(source, target) {
    const staff = await source.collection('users').find({}).toArray();
    const existing = await target.collection('users').find({}, { projection: { email: 1, phone_number: 1, role: 1 } }).toArray();
    const staffRoles = ['admin', SALES_ROLE];
    const idMap = new Map();
    const ops = [];
    const report = { matched: [], inserted: [], conflicts: [] };

    for (const user of staff) {
        const email = emailKey(user.email);
        const phone = phoneKey(user.phone);
        const samePerson = existing.find(
            (u) => staffRoles.includes(u.role) && (emailKey(u.email) === email || (phone && phoneKey(u.phone_number) === phone)),
        );
        const fields = {
            permissions: user.permissions || [],
            cities: user.cities || [],
            spaceTypes: user.spaceTypes || [],
            passwordHash: user.passwordHash,
            lastLoginAt: user.lastLoginAt,
        };

        if (samePerson) {
            idMap.set(String(user._id), samePerson._id);
            report.matched.push(user.name);
            ops.push({ updateOne: { filter: { _id: samePerson._id }, update: { $set: fields } } });
            continue;
        }

        const taken = existing.find((u) => phone && phoneKey(u.phone_number) === phone);
        if (taken) {
            report.conflicts.push(`${user.name}: phone already used by a ${taken.role} account`);
            continue;
        }

        report.inserted.push(user.name);
        ops.push({
            updateOne: {
                filter: { _id: user._id },
                update: {
                    $set: fields,
                    $setOnInsert: {
                        name: user.name,
                        email,
                        phone_number: user.phone || `crm-${user._id}`,
                        gender: ['male', 'female', 'other'].includes(user.gender) ? user.gender : undefined,
                        password: user.passwordHash,
                        role: user.role === 'admin' ? 'admin' : SALES_ROLE,
                        login_type: 'spacehaat',
                        is_active: user.status !== 'disabled',
                        createdBy: user.createdBy,
                        added_on: user.createdAt,
                        updated_on: user.updatedAt,
                    },
                },
                upsert: true,
            },
        });
    }

    if (report.conflicts.length) {
        throw new Error(`Resolve these staff accounts first:\n  ${report.conflicts.join('\n  ')}`);
    }
    if (apply && ops.length) await target.collection('users').bulkWrite(ops, { ordered: false });
    return { idMap, report };
}

function toEnquiry(lead, idMap) {
    const stage = lead.stage || 'new';
    const spaceType = lead.spaceType || 'CW';
    return {
        other_info: { name: lead.name || '', phone_number: lead.contact || '', email: lead.email || '' },
        companyName: lead.company || '',
        city: lead.city || '',
        microlocation: lead.microlocation || '',
        location: [lead.microlocation, lead.city].filter(Boolean),
        interested_in: (lead.interestedIn || []).join(', '),
        interestedIn: lead.interestedIn || [],
        space_type: spaceLabelFromCode(spaceType),
        spaceType,
        no_of_seats: String(lead.seats || 0),
        seats: lead.seats || 0,
        seatRange: lead.seatRange || '',
        budget: String(lead.budget || 0),
        budgetAmount: lead.budget || 0,
        lead_stage: enquiryStage(stage),
        status: stage === 'won' || stage === 'lost' ? 'resolved' : 'in-queue',
        leadSource: enquirySource(lead.source),
        moveIn: lead.moveIn || '',
        rawEnquiry: lead.rawEnquiry || '',
        amenities: lead.amenities || [],
        leadDate: lead.leadDate || lead.createdAt,
        assignedUsers: lead.assigneeId ? [remapUser(lead.assigneeId, idMap)] : [],
        createdBy: remapUser(lead.createdBy, idMap),
        listingIds: lead.listingIds || [],
        proposalIds: lead.proposalIds || [],
        visitIds: lead.visitIds || [],
        priority: lead.priority || 'normal',
        dueAt: lead.dueAt,
        reminderSetAt: lead.reminderSetAt,
        reminderSentAt: lead.reminderSentAt,
        lostReason: lead.lostReason || '',
        notes: (lead.notes || []).map((n) => ({
            _id: new mongoose.Types.ObjectId(),
            note: n.text,
            who: n.who,
            added_on: n.at,
        })),
        lead_id: `CRM${String(lead._id).slice(-8).toUpperCase()}`,
        isOtp: false,
        last_reminder_sent: 0,
        added_on: lead.createdAt,
        updated_on: lead.updatedAt,
    };
}

async function writeBatches(collection, ops) {
    if (!apply) return;
    for (let i = 0; i < ops.length; i += BATCH) {
        await collection.bulkWrite(ops.slice(i, i + BATCH), { ordered: false });
    }
}

async function copyLeads(source, target, idMap) {
    const leads = await source.collection('leads').find({}).toArray();
    const ops = leads.map((lead) => ({
        replaceOne: { filter: { _id: lead._id }, replacement: toEnquiry(lead, idMap), upsert: true },
    }));
    await writeBatches(target.collection('enquiries'), ops);
    return leads.length;
}

/** Copies a collection as is, rewriting the listed user-id fields for merged staff. */
async function copyCollection(source, target, name, userFields, idMap) {
    const rows = await source.collection(name).find({}).toArray();
    const ops = rows.map((row) => {
        const doc = { ...row };
        for (const field of userFields) doc[field] = remapUser(doc[field], idMap);
        return { replaceOne: { filter: { _id: row._id }, replacement: doc, upsert: true } };
    });
    await writeBatches(target.collection(name), ops);
    return rows.length;
}

async function main() {
    const sourceUri = process.env.HAAT_MONGODB_URI;
    if (!sourceUri) throw new Error('Set HAAT_MONGODB_URI to the haat-backend database');
    if (sourceUri === database.uri) throw new Error('Source and target are the same database');

    const source = (await mongoose.createConnection(sourceUri).asPromise()).db;
    const target = (await mongoose.createConnection(database.uri).asPromise()).db;

    const { idMap, report } = await mergeUsers(source, target);
    console.log('staff matched to existing users:', report.matched);
    console.log('staff added:', report.inserted);

    const backfilled = await backfillEnquiries(target.collection('enquiries'), { dryRun: !apply });
    console.log('existing enquiries backfilled:', backfilled);
    console.log('leads -> enquiries:', await copyLeads(source, target, idMap));
    console.log('listings:', await copyCollection(source, target, 'listings', [], idMap));
    console.log('proposals:', await copyCollection(source, target, 'proposals', ['createdBy'], idMap));
    console.log('activities:', await copyCollection(source, target, 'activities', [], idMap));
    console.log('clientdirectories:', await copyCollection(source, target, 'clientdirectories', ['createdBy'], idMap));
    console.log('devices:', await copyCollection(source, target, 'devices', ['userId'], idMap));
    console.log('refreshtokens:', await copyCollection(source, target, 'refreshtokens', ['userId'], idMap));

    console.log(apply ? '\nDone.' : '\nPreview only. Re-run with --apply to write.');
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
