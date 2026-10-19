/**
 * Copies every WorkSpace `seo` object into `new_seo`, replacing the word
 * "spacehaat" with "spacewallah" in all text fields (case is preserved:
 * Spacehaat -> Spacewallah, SPACEHAAT -> SPACEWALLAH). `seo` is never modified.
 *
 * Only workspaces without a `new_seo` are touched, so re-running never
 * overwrites values edited in the admin panel (unless --overwrite is passed).
 *
 * Usage:
 *   node src/scripts/workspace-new-seo.js            Preview only, no DB writes.
 *   node src/scripts/workspace-new-seo.js --apply    Write new_seo.
 *   Add --overwrite to also replace existing new_seo values.
 */
import '../config/loadEnv.js';
import mongoose from 'mongoose';
import database from '../config/database.js';
import models from '../models/index.js';

const WorkSpace = models['WorkSpace'];
const BATCH_SIZE = 500;

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const overwrite = args.includes('--overwrite');

function replaceBrand(text) {
    return text.replace(/spacehaat/gi, (match) => {
        if (match === match.toUpperCase()) return 'SPACEWALLAH';
        if (match[0] === match[0].toUpperCase()) return 'Spacewallah';
        return 'spacewallah';
    });
}

// Deep copy of the seo object; strings get the brand replacement, ObjectIds and other values are kept as is.
function copySeo(value) {
    if (typeof value === 'string') return replaceBrand(value);
    if (value instanceof mongoose.Types.ObjectId || value instanceof Date) return value;
    if (Array.isArray(value)) return value.map(copySeo);
    if (value && typeof value === 'object') {
        const out = {};
        for (const [key, inner] of Object.entries(value)) {
            if (key === '_id') continue;
            out[key] = copySeo(inner);
        }
        return out;
    }
    return value;
}

async function main() {
    await mongoose.connect(database.uri);
    try {
        const condition = { seo: { $exists: true, $ne: null } };
        if (!overwrite) condition.new_seo = { $exists: false };

        const spaces = await WorkSpace.find(condition).select('name seo').lean();
        let changed = 0;
        const samples = [];
        let ops = [];
        let written = 0;

        for (const space of spaces) {
            const newSeo = copySeo(space.seo);
            if (JSON.stringify(newSeo) !== JSON.stringify(copySeoWithoutReplace(space.seo))) {
                changed++;
                if (samples.length < 5) samples.push({ name: space.name, before: space.seo.description, after: newSeo.description });
            }
            ops.push({ updateOne: { filter: { _id: space._id }, update: { $set: { new_seo: newSeo } } } });
            if (apply && ops.length >= BATCH_SIZE) {
                written += (await WorkSpace.bulkWrite(ops, { ordered: false })).modifiedCount;
                ops = [];
            }
        }
        if (apply && ops.length) written += (await WorkSpace.bulkWrite(ops, { ordered: false })).modifiedCount;

        console.log(`Workspaces to fill: ${spaces.length}, with "spacehaat" replaced: ${changed}`);
        for (const s of samples) console.log(`\n${s.name}\n  before: ${s.before}\n  after:  ${s.after}`);
        console.log(apply ? `\nWrote new_seo on ${written} workspaces.` : '\nPreview only. Run with --apply to write.');
    } finally {
        await mongoose.disconnect();
    }
}

function copySeoWithoutReplace(value) {
    return JSON.parse(JSON.stringify(value, (key, inner) => (key === '_id' ? undefined : inner)));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
