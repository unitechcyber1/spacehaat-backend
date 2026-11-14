/**
 * Puts coworking spaces back in Google that an admin-form bug switched to `noindex`.
 *
 * The admin forms used to load the "index" checkbox ticked only when robots was exactly
 * "index, follow"; any other value (empty, "index,follow", …) saved as "noindex, nofollow".
 * This finds approved spaces whose `seo` or `new_seo` robots say noindex and sets them back to
 * "index, follow". Nothing else on the space changes.
 *
 * Usage (on the server, from the backend folder):
 *   node src/scripts/reindex-noindex-spaces.js                         Preview only: lists the spaces.
 *   node src/scripts/reindex-noindex-spaces.js --keep slug-a,slug-b    Preview, leaving these hidden.
 *   node src/scripts/reindex-noindex-spaces.js --keep slug-a --apply   Write the change.
 */
import '../config/loadEnv.js';
import mongoose from 'mongoose';
import database from '../config/database.js';
import models from '../models/index.js';

const { WorkSpace } = models;
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const keepArg = args[args.indexOf('--keep') + 1];
const keep = new Set(args.includes('--keep') && keepArg ? keepArg.split(',').map((s) => s.trim()).filter(Boolean) : []);

const NOINDEX = /noindex/i;

async function main() {
    await mongoose.connect(database.uri);
    const rows = await WorkSpace.find({
        status: 'approve',
        $or: [{ 'seo.robots': NOINDEX }, { 'new_seo.robots': NOINDEX }],
    })
        .select('name slug seo.robots new_seo.robots is_active')
        .sort({ slug: 1 })
        .lean();

    const targets = rows.filter((r) => !keep.has(r.slug));
    console.log(`Approved spaces set to noindex: ${rows.length}`);
    console.log(`Kept hidden (--keep): ${rows.length - targets.length}`);
    console.log(`To put back in Google: ${targets.length}\n`);
    for (const r of rows) {
        const mark = keep.has(r.slug) ? 'KEEP ' : 'INDEX';
        console.log(`${mark}  ${r.slug}  |  ${r.name}  |  seo: ${r.seo?.robots || '-'}  |  new_seo: ${r.new_seo?.robots || '-'}`);
    }

    if (!apply) {
        console.log('\nPreview only. Re-run with --apply to write.');
        return;
    }

    let changed = 0;
    for (const r of targets) {
        const set = {};
        if (NOINDEX.test(r.seo?.robots || '')) set['seo.robots'] = 'index, follow';
        if (NOINDEX.test(r.new_seo?.robots || '')) set['new_seo.robots'] = 'index, follow';
        if (!Object.keys(set).length) continue;
        // timestamps: false — this is a fix, not a content update, so `updated_on` stays as it was.
        const res = await WorkSpace.updateOne({ _id: r._id }, { $set: set }, { timestamps: false });
        changed += res.modifiedCount;
    }
    console.log(`\nUpdated ${changed} spaces to "index, follow".`);
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
