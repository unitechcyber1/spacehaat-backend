/**
 * Decides which live PG pages Google should index (`seo_quality_ok`), from their own content:
 *   - description of at least 60 words,
 *   - less than half of it made of template sentences that 5+ other PGs also use
 *     (PG name, area, city and numbers are ignored when comparing),
 *   - at least 3 photos that no other PG uses.
 * PGs that fail get `noindex` on the website and leave the sitemap; city and locality pages are not
 * affected. PGs marked `seo_proven_traffic` (they already earned Google clicks/impressions) are kept.
 * A PG's `seo_index_override` ('index' / 'noindex', set in the admin) always wins.
 *
 * Usage (from the backend folder):
 *   node src/scripts/pg-index-quality.js            Preview; writes pg-index-report.csv
 *   node src/scripts/pg-index-quality.js --apply    Save the result on each live PG.
 *   --keep-file pages.csv   CSV with a `slug` column (or one slug per line): marks those PGs as having
 *                           earned Google traffic, so they stay indexed now and in later runs.
 * Re-run after the team rewrites descriptions or adds PGs.
 */
import '../config/loadEnv.js';
import fs from 'fs';
import mongoose from 'mongoose';
import database from '../config/database.js';
import models from '../models/index.js';

const { PG } = models;
const apply = process.argv.includes('--apply');
const keepFile = process.argv.includes('--keep-file') ? process.argv[process.argv.indexOf('--keep-file') + 1] : '';

/** Slugs from a CSV with a `slug` column, or a plain list. */
function readKeepSlugs(file) {
    if (!file) return new Set();
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim());
    const head = lines[0].split(',').map((h) => h.replace(/"/g, '').trim().toLowerCase());
    const col = head.indexOf('slug');
    const rows = col >= 0 ? lines.slice(1).map((l) => l.split(',')[col]) : lines;
    return new Set(rows.map((s) => String(s || '').replace(/"/g, '').trim().toLowerCase()).filter(Boolean));
}
const REPORT = process.env.REPORT_PATH || 'pg-index-report.csv';
const LIVE = { delete: { $ne: true }, active: true, status: 'approve' };
const MIN_WORDS = 60;
const MAX_TEMPLATE_SHARE = 0.5;
const TEMPLATE_USES = 5;
const MIN_OWN_PHOTOS = 3;

const strip = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const esc = (s) => String(s).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const imageKey = (row) => String(row?.image?._id || row?.image || row?.url || '');

function sentencesOf(pg) {
    const text = strip(pg.new_description || pg.description).toLowerCase();
    const names = [pg.name, pg.locality, pg.city].filter(Boolean).map(esc);
    const mask = names.length ? new RegExp(names.join('|'), 'g') : null;
    const out = new Set();
    for (const raw of text.split(/[.!?]\s+/)) {
        let s = raw.trim();
        if (mask) s = s.replace(mask, '#');
        s = s.replace(/\d+/g, '0');
        if (s.split(' ').length >= 6) out.add(s);
    }
    return [...out];
}

async function main() {
    await mongoose.connect(database.uri);
    const pgs = await PG.find(LIVE).select('name slug city locality description new_description images seo_index_override seo_proven_traffic').lean();
    const keep = readKeepSlugs(keepFile);
    if (keepFile) console.log(`Keep-file: ${keep.size} slugs (${pgs.filter((p) => keep.has(String(p.slug).toLowerCase())).length} match live PGs)`);

    const sentenceUses = new Map();
    const photoUses = new Map();
    const perPg = pgs.map((pg) => {
        const sentences = sentencesOf(pg);
        for (const s of sentences) sentenceUses.set(s, (sentenceUses.get(s) || 0) + 1);
        const photos = [...new Set((pg.images || []).map(imageKey).filter(Boolean))];
        for (const p of photos) photoUses.set(p, (photoUses.get(p) || 0) + 1);
        return { pg, sentences, photos, words: strip(pg.new_description || pg.description).split(' ').filter(Boolean).length };
    });

    const lines = [['slug', 'name', 'city', 'locality', 'result', 'reason', 'words', 'template_share', 'own_photos', 'override'].join(',')];
    const counts = { index: 0, noindex: 0 };
    const reasons = {};
    const byCity = {};
    const updates = [];
    for (const { pg, sentences, photos, words } of perPg) {
        const templ = sentences.length ? sentences.filter((s) => sentenceUses.get(s) > TEMPLATE_USES).length / sentences.length : 1;
        const ownPhotos = photos.filter((p) => photoUses.get(p) === 1).length;
        const why = [];
        if (words < MIN_WORDS) why.push(`description ${words} words`);
        if (templ >= MAX_TEMPLATE_SHARE) why.push(`template description (${Math.round(templ * 100)}%)`);
        if (ownPhotos < MIN_OWN_PHOTOS) why.push(`${ownPhotos} own photos`);
        const proven = pg.seo_proven_traffic === true || keep.has(String(pg.slug).toLowerCase());
        const ok = why.length === 0 || proven;
        counts[ok ? 'index' : 'noindex'] += 1;
        for (const r of why) { const k = r.replace(/[\d%()]+/g, '').trim(); reasons[k] = (reasons[k] || 0) + 1; }
        const c = pg.city || '-';
        byCity[c] ??= { index: 0, noindex: 0 };
        byCity[c][ok ? 'index' : 'noindex'] += 1;
        const note = why.length === 0 ? 'ok' : ok ? `kept: earned Google traffic (${why.join('; ')})` : why.join('; ');
        updates.push({ id: pg._id, ok, note, proven });
        lines.push([pg.slug, pg.name, pg.city, pg.locality, ok ? 'index' : 'noindex', note, words, templ.toFixed(2), ownPhotos, pg.seo_index_override || 'auto'].map(csv).join(','));
    }

    fs.writeFileSync(REPORT, `${lines.join('\n')}\n`);
    console.log(`Live PGs: ${pgs.length}`);
    console.log(`Index (good own content): ${counts.index}`);
    console.log(`Noindex (weak or template content): ${counts.noindex}`);
    console.log('Reasons:', reasons);
    console.log('By city:', Object.entries(byCity).sort((a, b) => b[1].index + b[1].noindex - a[1].index - a[1].noindex).slice(0, 12).map(([k, v]) => `${k} ${v.index}/${v.index + v.noindex}`).join(', '));
    const overrides = pgs.filter((p) => p.seo_index_override && p.seo_index_override !== 'auto').length;
    if (overrides) console.log(`PGs with a manual override (always win): ${overrides}`);
    console.log(`Report: ${REPORT}`);

    if (!apply) {
        console.log('\nPreview only. Re-run with --apply to save.');
        return;
    }
    const now = new Date();
    for (let i = 0; i < updates.length; i += 500) {
        // timestamps: false — a quality mark, not a content change (keeps sitemap lastmod honest).
        await PG.bulkWrite(updates.slice(i, i + 500).map((u) => ({
            updateOne: {
                filter: { _id: u.id },
                update: { $set: { seo_quality_ok: u.ok, seo_quality_note: u.note, seo_quality_checked_at: now, ...(u.proven ? { seo_proven_traffic: true } : {}) } },
                timestamps: false,
            },
        })));
    }
    console.log(`\nSaved on ${updates.length} PGs.`);
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
