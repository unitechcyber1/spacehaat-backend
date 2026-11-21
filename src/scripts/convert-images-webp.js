/**
 * Convert listing photos to resized WebP (max 1280px, quality 78) and point their Image records at
 * the new files. Every section (PG, coworking / virtual office, coliving, office space, managed office)
 * reads photos from the shared `images` collection, so one pass fixes the website and the app.
 *
 * PREVIEW BY DEFAULT: downloads a sample, converts it on this machine and writes before/after files
 * plus a comparison page to --out. Nothing is written to S3 or the database.
 *
 *   node src/scripts/convert-images-webp.js --sample 24                    # preview (default)
 *   node src/scripts/convert-images-webp.js --apply --only pg --limit 200  # convert 200 PG photos
 *   node src/scripts/convert-images-webp.js --rollback --only pg           # point records back at originals
 *   node src/scripts/convert-images-webp.js --cache-headers --live-only    # preview: which files lack Cache-Control
 *   node src/scripts/convert-images-webp.js --cache-headers --live-only --apply   # add it (file content unchanged)
 *
 * Options:
 *   --only pg,coworking,coliving,office,managed,misnamed   sections (default: all)
 *   --sample N        preview size (default 24), spread over the sections
 *   --limit N         --apply: stop after N photos
 *   --concurrency N   photos at a time (default 3)
 *   --live-only       only photos of listings shown on the website (status 'approve', not deleted)
 *   --out DIR         preview folder (default ~/Desktop/Image WebP preview)
 *
 * Safety (--apply):
 *   - Originals stay in S3; the WebP is uploaded next to them under a new key, never over a file.
 *   - The old link and metadata are saved in `converted_from`, so --rollback restores them exactly.
 *   - Records with `converted_from` are skipped, so a stopped run can simply be started again.
 *   - A photo is left alone when the WebP would not be smaller.
 */
import '../config/loadEnv.js';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import mongoose from 'mongoose';
import sharp from 'sharp';
import aws from 'aws-sdk';
import database from '../config/database.js';
import storage from '../config/storage.js';

const CDN = 'https://img.spacewallah.com';
const MAX_SIDE = 1280;
const QUALITY = 78;
/** Hosts whose path is a key in our bucket. Anything else (third-party S3, placeholders) is skipped. */
const OUR_HOSTS = new Set(['img.spacehaat.com', 'img.spacewallah.com', `${storage.s3.bucket}.s3.${storage.s3.region}.amazonaws.com`]);
/** 2024 uploads named `.webp` that are really JPEG files (served as image/webp, without WebP's savings). */
const MISNAMED_FOLDER = 'images/latest_images_2024';
/** A real WebP is re-encoded only when it is wider/taller than MAX_SIDE or bigger than this. */
const WEBP_OK_BYTES = 250 * 1024;

const SECTIONS = {
    pg: { collection: 'pgs', label: 'PG' },
    coworking: { collection: 'workspaces', label: 'Coworking / virtual office' },
    coliving: { collection: 'colivingspaces', label: 'Coliving' },
    office: { collection: 'officespaces', label: 'Office space' },
    managed: { collection: 'managedoffices', label: 'Managed office' },
};
/** Share of the preview sample per section. */
const SAMPLE_WEIGHTS = { pg: 10, coworking: 4, coliving: 4, office: 2, managed: 0, misnamed: 4 };

function parseArgs(argv) {
    const args = { sample: 24, concurrency: 3, limit: Infinity, only: null, apply: false, rollback: false, liveOnly: false, cacheHeaders: false, out: path.join(os.homedir(), 'Desktop', 'Image WebP preview') };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        const next = () => argv[(i += 1)];
        if (a === '--apply') args.apply = true;
        else if (a === '--rollback') args.rollback = true;
        else if (a === '--cache-headers') args.cacheHeaders = true;
        else if (a === '--live-only') args.liveOnly = true;
        else if (a === '--sample') args.sample = Number(next());
        else if (a === '--limit') args.limit = Number(next());
        else if (a === '--concurrency') args.concurrency = Math.max(1, Number(next()));
        else if (a === '--only') args.only = next().split(',').map((s) => s.trim()).filter(Boolean);
        else if (a === '--out') args.out = next();
        else throw new Error(`Unknown option ${a}`);
    }
    if (args.apply && args.rollback) throw new Error('Use either --apply or --rollback, not both.');
    if (args.cacheHeaders && args.rollback) throw new Error('--cache-headers cannot be combined with --rollback.');
    return args;
}

/** S3 key of a stored link, or null when the file is not in our bucket. */
function keyOf(s3Link) {
    try {
        const u = new URL(String(s3Link || '').trim());
        if (!OUR_HOSTS.has(u.hostname)) return null;
        return decodeURIComponent(u.pathname.replace(/^\/+/, ''));
    } catch {
        return null;
    }
}

const isWebp = (key) => /\.webp$/i.test(key);

/** Listings the website shows: approved (the user API filters on this), not deleted or switched off. */
const LIVE = { status: 'approve', delete: { $ne: true }, active: { $ne: false } };

/** Image ids used by a section's listings (gallery photos and the main photo); `liveOnly` = shown listings only. */
async function imageIdsFor(db, collection, liveOnly = false) {
    const coll = db.collection(collection);
    const where = liveOnly ? LIVE : {};
    const [gallery, main] = await Promise.all([coll.distinct('images.image', where), coll.distinct('image', where)]);
    return [...gallery, ...main].filter((id) => id instanceof mongoose.Types.ObjectId);
}

/** Records that need converting in a section: not WebP yet, or one of the 2024 `.webp` files that are JPEG inside. */
function needsWorkFilter(ids, section) {
    const base = { _id: { $in: ids }, converted_from: { $exists: false }, webp_skip: { $exists: false }, s3_link: { $type: 'string', $ne: '' } };
    if (section === 'misnamed') return { ...base, s3_link: { $regex: `/${MISNAMED_FOLDER}/.+\\.webp$`, $options: 'i' } };
    return { ...base, s3_link: { $type: 'string', $not: /\.webp$/i } };
}

async function download(key) {
    const res = await fetch(`${CDN}/${key.split('/').map(encodeURIComponent).join('/')}`);
    if (!res.ok) throw new Error(`download ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
}

async function convert(buffer) {
    const meta = await sharp(buffer, { failOn: 'none' }).metadata();
    const { data, info } = await sharp(buffer, { failOn: 'none' })
        .rotate() // apply the phone's EXIF orientation before the tag is dropped
        .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY, effort: 5 })
        .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, before: { width: meta.width, height: meta.height, format: meta.format } };
}

/** Decide whether a converted file should replace the original (by its real format, not its name). */
function worthIt(key, originalBytes, before, outBytes) {
    if (before.format === 'webp') {
        const tooBig = originalBytes > WEBP_OK_BYTES || (before.width || 0) > MAX_SIDE || (before.height || 0) > MAX_SIDE;
        return tooBig && outBytes < originalBytes * 0.9;
    }
    return outBytes < originalBytes;
}

/** New key next to the original: photo.jpg -> photo.webp; an existing WebP -> photo-w1280.webp. */
function newKeyFor(key) {
    const dir = path.posix.dirname(key);
    const base = path.posix.basename(key).replace(/\.[^.]+$/, '');
    return `${dir}/${base}${isWebp(key) ? `-w${MAX_SIDE}` : ''}.webp`;
}

async function pool(items, size, worker) {
    let next = 0;
    const run = async () => {
        while (next < items.length) {
            const i = next++;
            await worker(items[i], i);
        }
    };
    await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
}

const kb = (n) => Math.round(n / 1024);

async function preview(db, args, sections) {
    const images = db.collection('images');
    const weights = sections.map((s) => [s, SAMPLE_WEIGHTS[s] ?? 1]).filter(([, w]) => w > 0);
    const totalWeight = weights.reduce((a, [, w]) => a + w, 0);
    const picks = [];
    let remaining = args.sample;
    for (const [i, [section, w]] of weights.entries()) {
        const n = i === weights.length - 1 ? remaining : Math.round((args.sample * w) / totalWeight);
        remaining -= n;
        if (n <= 0) continue;
        const ids = section === 'misnamed'
            ? (await Promise.all(Object.values(SECTIONS).map((s) => imageIdsFor(db, s.collection, args.liveOnly)))).flat()
            : await imageIdsFor(db, SECTIONS[section].collection, args.liveOnly);
        // Draw extra so photos outside our bucket can be dropped and still fill the quota.
        const docs = await images.aggregate([{ $match: needsWorkFilter(ids, section) }, { $sample: { size: n * 3 } }]).toArray();
        picks.push(...docs.filter((d) => keyOf(d.s3_link)).slice(0, n).map((d) => ({ section, doc: d })));
    }

    await fs.mkdir(args.out, { recursive: true });
    const rows = [];
    await pool(picks, args.concurrency, async ({ section, doc }, i) => {
        const key = keyOf(doc.s3_link);
        const row = { n: i + 1, section, id: String(doc._id), key, newKey: newKeyFor(key) };
        try {
            const original = await download(key);
            const out = await convert(original);
            const tag = String(i + 1).padStart(2, '0');
            row.before = `${tag}-before${path.extname(key).toLowerCase() || '.img'}`;
            row.after = `${tag}-after.webp`;
            await fs.writeFile(path.join(args.out, row.before), original);
            await fs.writeFile(path.join(args.out, row.after), out.data);
            Object.assign(row, {
                beforeKB: kb(original.length), afterKB: kb(out.data.length),
                beforeSize: `${out.before.width}×${out.before.height} ${out.before.format}`, afterSize: `${out.width}×${out.height} webp`,
                wouldConvert: worthIt(key, original.length, out.before, out.data.length),
            });
        } catch (e) {
            row.error = e.message;
        }
        rows.push(row);
        console.log(`${String(row.n).padStart(2)} ${section.padEnd(10)} ${row.error ? `ERROR ${row.error}` : `${row.beforeKB} KB ${row.beforeSize} -> ${row.afterKB} KB ${row.afterSize}${row.wouldConvert ? '' : '  (would skip: not smaller)'}`}`);
    });
    rows.sort((a, b) => a.n - b.n);

    const ok = rows.filter((r) => !r.error);
    const before = ok.reduce((a, r) => a + r.beforeKB, 0);
    const after = ok.reduce((a, r) => a + (r.wouldConvert ? r.afterKB : r.beforeKB), 0);
    const bySection = {};
    for (const r of ok) {
        const s = (bySection[r.section] ??= { n: 0, before: 0, after: 0 });
        s.n += 1; s.before += r.beforeKB; s.after += r.wouldConvert ? r.afterKB : r.beforeKB;
    }

    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WebP preview</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:24px;color:#1d1d1f;background:#fafaf8}h1{font-size:22px;margin:0 0 4px}table{border-collapse:collapse;margin:12px 0 28px}td,th{padding:6px 12px;border-bottom:1px solid #e5e5e0;text-align:left}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 36px}.pair img{width:100%;border-radius:8px;background:#eee}.cap{font-size:13px;color:#555;margin:4px 0}.h{font-weight:600;margin:0 0 6px}.skip{color:#b45309}</style></head><body>
<h1>WebP preview: ${ok.length} photos</h1><p>Before (left) and after (right), shown at the same width. Nothing has been changed in S3 or the database.</p>
<table><tr><th>Section</th><th>Photos</th><th>Before</th><th>After</th><th>Saved</th></tr>
${Object.entries(bySection).map(([s, v]) => `<tr><td>${esc(s)}</td><td>${v.n}</td><td>${v.before} KB</td><td>${v.after} KB</td><td>${Math.round(100 - (v.after / v.before) * 100)}%</td></tr>`).join('')}
<tr><th>Total</th><th>${ok.length}</th><th>${before} KB</th><th>${after} KB</th><th>${Math.round(100 - (after / before) * 100)}%</th></tr></table>
${rows.map((r) => r.error ? `<p class="h">${r.n}. ${esc(r.section)} · ${esc(r.key)}: error ${esc(r.error)}</p>` : `<p class="h">${r.n}. ${esc(r.section)} · ${esc(r.key)}${r.wouldConvert ? '' : ' <span class="skip">(would be left as is: WebP not smaller)</span>'}</p>
<div class="pair"><div><img src="${esc(r.before)}" alt="before"><p class="cap">Before: ${r.beforeKB} KB · ${esc(r.beforeSize)}</p></div><div><img src="${esc(r.after)}" alt="after"><p class="cap">After: ${r.afterKB} KB · ${esc(r.afterSize)}</p></div></div>`).join('\n')}
</body></html>`;
    await fs.writeFile(path.join(args.out, 'compare.html'), html);
    await fs.writeFile(path.join(args.out, 'report.json'), JSON.stringify(rows, null, 1));
    console.log(`\n${ok.length}/${rows.length} converted in preview. ${before} KB -> ${after} KB (${Math.round(100 - (after / before) * 100)}% smaller).`);
    console.log(`Open: ${path.join(args.out, 'compare.html')}`);
}

async function apply(db, args, sections) {
    const images = db.collection('images');
    const s3 = new aws.S3({ region: storage.s3.region, signatureVersion: 'v4', accessKeyId: storage.s3.key, secretAccessKey: storage.s3.secret });
    const exists = (Key) => s3.headObject({ Bucket: storage.s3.bucket, Key }).promise().then(() => true, (e) => (e.code === 'NotFound' ? false : Promise.reject(e)));
    let done = 0;
    const stats = { converted: 0, skipped: 0, failed: 0, beforeKB: 0, afterKB: 0 };
    for (const section of sections) {
        if (done >= args.limit) break;
        const ids = section === 'misnamed'
            ? (await Promise.all(Object.values(SECTIONS).map((s) => imageIdsFor(db, s.collection, args.liveOnly)))).flat()
            : await imageIdsFor(db, SECTIONS[section].collection, args.liveOnly);
        const docs = await images.find(needsWorkFilter(ids, section)).limit(Math.max(0, args.limit - done)).toArray();
        console.log(`${section}: ${docs.length} photos to process`);
        // A skipped photo is marked so later runs do not download it again (--rollback leaves the mark).
        const skip = async (doc, reason) => {
            stats.skipped += 1;
            await images.updateOne({ _id: doc._id }, { $set: { webp_skip: reason } });
        };
        await pool(docs, args.concurrency, async (doc) => {
            const key = keyOf(doc.s3_link);
            try {
                if (!key) { await skip(doc, 'not in our bucket'); return; }
                const original = await download(key);
                const out = await convert(original);
                if (!worthIt(key, original.length, out.before, out.data.length)) { await skip(doc, 'webp not smaller'); return; }
                let newKey = newKeyFor(key);
                if (await exists(newKey)) newKey = newKey.replace(/\.webp$/, `-w${MAX_SIDE}.webp`);
                if (await exists(newKey)) throw new Error(`target exists: ${newKey}`);
                await s3.putObject({
                    Bucket: storage.s3.bucket, Key: newKey, Body: out.data,
                    ContentType: 'image/webp', CacheControl: 'public, max-age=31536000, immutable',
                }).promise();
                const host = new URL(doc.s3_link).origin;
                const res = await images.updateOne({ _id: doc._id, converted_from: { $exists: false } }, {
                    $set: {
                        s3_link: `${host}/${newKey}`, name: path.posix.basename(newKey), size: out.data.length,
                        width: out.width, height: out.height, converted_at: new Date(),
                        converted_from: { s3_link: doc.s3_link, name: doc.name ?? null, size: doc.size ?? null, width: doc.width ?? null, height: doc.height ?? null },
                    },
                });
                if (res.modifiedCount !== 1) throw new Error('record changed during conversion');
                stats.converted += 1; stats.beforeKB += kb(original.length); stats.afterKB += kb(out.data.length);
            } catch (e) {
                stats.failed += 1;
                console.log(`  failed ${doc._id} ${key}: ${e.message}`);
            } finally {
                done += 1;
                if (done % 50 === 0) console.log(`  ${done} done`, JSON.stringify(stats));
            }
        });
    }
    console.log('Finished', stats);
}

/**
 * --cache-headers: give photos already in S3 a one-year browser cache header, so CloudFront passes
 * it on (custom CloudFront response headers need the Business plan). Each file is copied onto itself
 * with its content type, storage class and metadata kept; the image bytes do not change.
 * Without --apply it only checks a sample (--sample N) and reports how many lack the header.
 */
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

async function cacheHeaders(db, args, sections) {
    const images = db.collection('images');
    const s3 = new aws.S3({ region: storage.s3.region, signatureVersion: 'v4', accessKeyId: storage.s3.key, secretAccessKey: storage.s3.secret });
    const Bucket = storage.s3.bucket;
    const ids = new Set();
    for (const section of sections.filter((s) => SECTIONS[s])) {
        for (const id of await imageIdsFor(db, SECTIONS[section].collection, args.liveOnly)) ids.add(String(id));
    }
    let docs = await images.find({ _id: { $in: [...ids].map((id) => new mongoose.Types.ObjectId(id)) }, s3_link: { $type: 'string', $ne: '' } })
        .project({ s3_link: 1 }).toArray();
    const keys = [...new Set(docs.map((d) => keyOf(d.s3_link)).filter(Boolean))];
    const work = args.apply ? keys.slice(0, args.limit) : keys.sort(() => Math.random() - 0.5).slice(0, args.sample);
    console.log(`${keys.length} files used by ${args.liveOnly ? 'live ' : ''}listings; checking ${work.length}${args.apply ? '' : ' (preview)'}`);
    const stats = { alreadySet: 0, updated: 0, wouldUpdate: 0, missing: 0, failed: 0 };
    let done = 0;
    await pool(work, args.concurrency, async (Key) => {
        try {
            const head = await s3.headObject({ Bucket, Key }).promise();
            if (head.CacheControl === CACHE_CONTROL) { stats.alreadySet += 1; return; }
            if (!args.apply) {
                stats.wouldUpdate += 1;
                if (stats.wouldUpdate <= 5) console.log(`  would set: ${Key} (${head.ContentType}, now: ${head.CacheControl || 'none'})`);
                return;
            }
            await s3.copyObject({
                Bucket, Key, CopySource: `${Bucket}/${Key.split('/').map(encodeURIComponent).join('/')}`,
                MetadataDirective: 'REPLACE', CacheControl: CACHE_CONTROL,
                ContentType: head.ContentType, Metadata: head.Metadata,
                ...(head.ContentEncoding ? { ContentEncoding: head.ContentEncoding } : {}),
                ...(head.ContentDisposition ? { ContentDisposition: head.ContentDisposition } : {}),
                ...(head.StorageClass ? { StorageClass: head.StorageClass } : {}),
            }).promise();
            stats.updated += 1;
        } catch (e) {
            if (e.code === 'NotFound') stats.missing += 1;
            else { stats.failed += 1; console.log(`  failed ${Key}: ${e.message}`); }
        } finally {
            done += 1;
            if (args.apply && done % 500 === 0) console.log(`  ${done}/${work.length}`, JSON.stringify(stats));
        }
    });
    console.log('Finished', stats);
    if (!args.apply && work.length) {
        const share = stats.wouldUpdate / work.length;
        console.log(`About ${Math.round(share * 100)}% lack the header, so roughly ${Math.round(share * keys.length)} of ${keys.length} files would be updated with --apply.`);
    }
}

async function rollback(db, sections) {
    const images = db.collection('images');
    for (const section of sections) {
        const ids = section === 'misnamed'
            ? (await Promise.all(Object.values(SECTIONS).map((s) => imageIdsFor(db, s.collection)))).flat()
            : await imageIdsFor(db, SECTIONS[section].collection);
        const docs = await images.find({ _id: { $in: ids }, converted_from: { $exists: true } }).toArray();
        for (const doc of docs) {
            const prev = doc.converted_from;
            await images.updateOne({ _id: doc._id }, {
                $set: { s3_link: prev.s3_link, name: prev.name, size: prev.size, width: prev.width, height: prev.height },
                $unset: { converted_from: '', converted_at: '' },
            });
        }
        console.log(`${section}: ${docs.length} records pointed back at their originals`);
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const all = [...Object.keys(SECTIONS), 'misnamed'];
    const sections = args.only ?? all;
    for (const s of sections) if (!all.includes(s)) throw new Error(`Unknown section ${s}; use ${all.join(', ')}`);
    await mongoose.connect(database.uri);
    const db = mongoose.connection.db;
    if (args.cacheHeaders) await cacheHeaders(db, args, sections);
    else if (args.apply) await apply(db, args, sections);
    else if (args.rollback) await rollback(db, sections);
    else await preview(db, args, sections);
}

main()
    .catch((e) => { console.error(e.message); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
