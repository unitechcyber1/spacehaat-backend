/**
 * Links hidden PGs to the live listing of the same PG (sets `duplicate_of`), so their old URLs redirect
 * to the live page instead of answering 410 Gone. Also reports PGs that are live twice, for a person
 * to decide which one to keep. Live PGs are never changed by this script.
 *
 * A hidden PG is linked only when exactly one live PG matches it:
 *   - same name, locality and city (ignoring case, spaces and punctuation), or
 *   - same URL without its "-2"/"-3"… ending, in the same city.
 *
 * Usage (on the server, from the backend folder):
 *   node src/scripts/link-duplicate-pgs.js            Preview; writes pg-duplicates-report.csv
 *   node src/scripts/link-duplicate-pgs.js --apply    Save duplicate_of on the matched hidden PGs.
 */
import '../config/loadEnv.js';
import fs from 'fs';
import mongoose from 'mongoose';
import database from '../config/database.js';
import models from '../models/index.js';
import { normalizeCitySlug, slugifyText } from '../utilities/pg-slug.js';

const { PG } = models;
const apply = process.argv.includes('--apply');
const REPORT = process.env.REPORT_PATH || 'pg-duplicates-report.csv';
const PUBLIC_PG = { delete: { $ne: true }, active: true, status: 'approve' };

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const keyOf = (pg) => `${norm(pg.name)}|${norm(slugifyText(pg.locality))}|${normalizeCitySlug(pg.city)}`;
const stemOf = (slug) => String(slug || '').replace(/-\d+$/, '');
const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function index(rows, keyFn) {
    const m = new Map();
    for (const r of rows) {
        const k = keyFn(r);
        if (!k) continue;
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(r);
    }
    return m;
}

async function main() {
    await mongoose.connect(database.uri);
    const fields = 'name locality city slug status active delete duplicate_of added_on images';
    const live = await PG.find(PUBLIC_PG).select(fields).lean();
    const hidden = await PG.find({ $nor: [PUBLIC_PG], slug: { $nin: [null, ''] } }).select(fields).lean();

    const liveByKey = index(live, keyOf);
    const liveByStem = index(live, (r) => `${stemOf(r.slug)}|${normalizeCitySlug(r.city)}`);

    const lines = [['type', 'hidden_or_first_slug', 'live_or_second_slug', 'name', 'locality', 'city', 'matched_by', 'note'].join(',')];
    const links = [];
    let ambiguous = 0;
    let unmatched = 0;
    for (const h of hidden) {
        if (h.duplicate_of) continue;
        let matches = liveByKey.get(keyOf(h)) || [];
        let by = 'name+locality+city';
        if (!matches.length) {
            matches = liveByStem.get(`${stemOf(h.slug)}|${normalizeCitySlug(h.city)}`) || [];
            by = 'same URL without number';
        }
        if (matches.length === 1) {
            links.push({ hidden: h, live: matches[0] });
            lines.push(['redirect', h.slug, matches[0].slug, h.name, h.locality, h.city, by, `hidden status: ${h.status}${h.delete ? ', deleted' : ''}`].map(csv).join(','));
        } else if (matches.length > 1) {
            ambiguous += 1;
            lines.push(['ambiguous', h.slug, matches.map((m) => m.slug).join(' | '), h.name, h.locality, h.city, by, 'several live matches: not linked'].map(csv).join(','));
        } else {
            unmatched += 1;
        }
    }

    // PGs live twice: same name, locality and city on two live listings.
    let twice = 0;
    for (const group of liveByKey.values()) {
        if (group.length < 2) continue;
        twice += 1;
        const [a, ...rest] = group.sort((x, y) => (y.images?.length || 0) - (x.images?.length || 0));
        for (const b of rest) {
            lines.push(['live twice', a.slug, b.slug, a.name, a.locality, a.city, 'name+locality+city',
                `photos ${a.images?.length || 0} vs ${b.images?.length || 0}; choose which to keep`].map(csv).join(','));
        }
    }

    fs.writeFileSync(REPORT, `${lines.join('\n')}\n`);
    console.log(`Live PGs: ${live.length}, hidden PGs: ${hidden.length}`);
    console.log(`Hidden PGs to redirect to a live copy: ${links.length}`);
    console.log(`Hidden PGs with several live matches (left alone): ${ambiguous}`);
    console.log(`Hidden PGs with no live copy (will answer 410 Gone): ${unmatched}`);
    console.log(`PGs live twice (decide which to keep): ${twice}`);
    console.log(`Report: ${REPORT}`);

    if (!apply) {
        console.log('\nPreview only. Re-run with --apply to save the redirects.');
        return;
    }
    let saved = 0;
    for (const { hidden: h, live: l } of links) {
        // timestamps: false — bookkeeping only, the hidden PG's content does not change.
        const res = await PG.updateOne({ _id: h._id, duplicate_of: { $exists: false } }, { $set: { duplicate_of: l._id } }, { timestamps: false });
        saved += res.modifiedCount;
    }
    console.log(`\nLinked ${saved} hidden PGs to their live copy.`);
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
