/**
 * Creates/updates office buildings from src/scripts/data/buildings.json and links their centres
 * (coworking `workspaces`, `managedoffices`) through `building_id`, for the website's building pages.
 *
 *   node src/scripts/link-buildings.js            # dry run: what would change
 *   node src/scripts/link-buildings.js --apply    # write
 *
 * Re-runnable: buildings are matched by slug; a centre linked to a building but no longer listed
 * under it in the file is unlinked. Location fields (city, area, coordinates, address) are taken
 * from the building's centres unless the file sets them.
 */
import '../config/loadEnv.js';
import fs from 'node:fs';
import mongoose from 'mongoose';

import database from '../config/database.js';
import models from '../models/index.js';

const { Building, WorkSpace, ManagedOffice } = models;
const APPLY = process.argv.includes('--apply');
const FILE = new URL('./data/buildings.json', import.meta.url);

const MODEL = { coworking: WorkSpace, 'managed-office': ManagedOffice };

function mostCommon(values) {
    const counts = new Map();
    for (const v of values) if (v) counts.set(String(v), (counts.get(String(v)) || 0) + 1);
    let best = null;
    let n = 0;
    for (const [v, c] of counts) if (c > n) [best, n] = [v, c];
    return best;
}

async function main() {
    const entries = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    await mongoose.connect(database.uri);
    console.log(APPLY ? 'APPLY' : 'DRY RUN (pass --apply to write)');

    let created = 0;
    let linked = 0;
    let unlinked = 0;
    const problems = [];

    for (const entry of entries) {
        const docs = [];
        for (const c of entry.centres) {
            const Model = MODEL[c.type];
            if (!Model) {
                problems.push(`${entry.slug}: unknown type ${c.type}`);
                continue;
            }
            const doc = await Model.findOne({ slug: c.slug }, { slug: 1, name: 1, location: 1, building_id: 1 }).lean();
            if (!doc) problems.push(`${entry.slug}: ${c.type} "${c.slug}" not found`);
            else docs.push({ ...doc, type: c.type });
        }

        const lat = docs.map((d) => d.location?.latitude).filter(Number.isFinite);
        const lng = docs.map((d) => d.location?.longitude).filter(Number.isFinite);
        const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
        const fields = {
            name: entry.name,
            city: entry.city ?? mostCommon(docs.map((d) => d.location?.city)),
            micro_location: entry.micro_location ?? mostCommon(docs.map((d) => d.location?.micro_location)),
            address: entry.address ?? (docs.map((d) => String(d.location?.address || d.location?.address1 || '').trim()).sort((a, b) => b.length - a.length)[0] || undefined),
            latitude: entry.latitude ?? avg(lat),
            longitude: entry.longitude ?? avg(lng),
            ...(entry.image ? { image: entry.image } : {}),
            ...(entry.description ? { description: entry.description } : {}),
            is_active: entry.is_active !== false,
        };

        let building = await Building.findOne({ slug: entry.slug }).lean();
        if (!building) {
            created += 1;
            if (APPLY) building = (await Building.create({ slug: entry.slug, ...fields })).toObject();
        } else if (APPLY) {
            await Building.updateOne({ _id: building._id }, { $set: fields });
        }
        console.log(`${building ? '' : '+ '}${entry.slug}: ${docs.length} centres`);
        if (!building) continue; // dry run of a new building

        const keep = new Set();
        for (const d of docs) {
            keep.add(`${d.type}:${d._id}`);
            if (String(d.building_id || '') === String(building._id)) continue;
            linked += 1;
            if (d.building_id) console.log(`    moves ${d.type} ${d.slug} from another building`);
            if (APPLY) await MODEL[d.type].updateOne({ _id: d._id }, { $set: { building_id: building._id } });
        }
        for (const [type, Model] of Object.entries(MODEL)) {
            const stale = await Model.find({ building_id: building._id }, { slug: 1 }).lean();
            for (const s of stale) {
                if (keep.has(`${type}:${s._id}`)) continue;
                unlinked += 1;
                console.log(`    unlink ${type} ${s.slug}`);
                if (APPLY) await Model.updateOne({ _id: s._id }, { $unset: { building_id: 1 } });
            }
        }
    }

    console.log(`\nbuildings new: ${created} | centre links set: ${linked}${APPLY ? '' : ' (existing buildings only)'} | unlinked: ${unlinked}`);
    if (problems.length) console.log('Problems:\n  ' + problems.join('\n  '));
    await mongoose.disconnect();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
