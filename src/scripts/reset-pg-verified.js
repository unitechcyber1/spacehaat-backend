/**
 * One-off: clears the bulk-set PG `verified` flag (every live PG had it, without an actual check), so
 * the website's "Verified" badge only shows on PGs the team verifies from the admin ("Verified on <date>").
 * The old value is kept in `verified_legacy`. PGs that already have a real verification are untouched.
 *
 *   node src/scripts/reset-pg-verified.js           Preview counts
 *   node src/scripts/reset-pg-verified.js --apply   Reset
 */
import '../config/loadEnv.js';
import mongoose from 'mongoose';
import database from '../config/database.js';
import models from '../models/index.js';

const { PG } = models;
const apply = process.argv.includes('--apply');
const filter = { verified: true, verified_at: { $exists: false } };

async function main() {
    await mongoose.connect(database.uri);
    const n = await PG.countDocuments(filter);
    console.log(`PGs marked verified without a verification date: ${n}`);
    if (!apply) return console.log('Preview only. Re-run with --apply to reset.');
    // timestamps: false — no content change, so sitemap lastmod stays as it is.
    const r = await PG.updateMany(filter, { $set: { verified: false, verified_legacy: true } }, { timestamps: false });
    console.log(`Reset ${r.modifiedCount} PGs (old value kept in verified_legacy).`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => mongoose.disconnect());
