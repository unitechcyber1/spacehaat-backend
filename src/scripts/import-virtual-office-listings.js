/**
 * Copies virtual office plans from another MongoDB (the old catalogue's `virtualofficeplans`
 * collection) into our VirtualOfficeListing collection, field for field.
 *
 * - Re-runs are safe: a record already imported (same source id, kept in `importRef`) is updated.
 * - No competitor brand names come across: any text mentioning one is left out, and image links
 *   on such domains are dropped.
 * - Images in the source are Image refs; their s3 links are copied as plain URLs.
 *
 * Usage (preview is the default; nothing is written without --apply):
 *   node src/scripts/import-virtual-office-listings.js
 *   node src/scripts/import-virtual-office-listings.js --apply
 * Options:
 *   --source <uri>   default mongodb://127.0.0.1:27017/cofynd-prod
 *   --target <uri>   default mongodb://127.0.0.1:27017/spacehaat-prod (the local copy)
 *   --production     write to the app's own database (MONGO_URI from .env) instead of --target
 */
import '../config/loadEnv.js';
import mongoose from 'mongoose';
import database from '../config/database.js';
import VirtualOfficeListingSchema from '../models/VirtualOfficeListing.js';
import { slugifyText } from '../utilities/pg-slug.js';

const args = process.argv.slice(2);
const argValue = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const apply = args.includes('--apply');
const sourceUri = argValue('--source', 'mongodb://127.0.0.1:27017/cofynd-prod');
const targetUri = args.includes('--production') ? database.uri : argValue('--target', 'mongodb://127.0.0.1:27017/spacehaat-prod');

const BANNED = /cofynd|myhq|anarock/i;
const TEXT_FIELDS = ['spaceName', 'city', 'state', 'locality', 'fullAddress', 'phoneNumber', 'cityTier', 'amenities', 'contactNotes', 'remarks', 'lastUpdatedLabel', 'couponCode'];
const hostOf = (uri) => {
    try {
        return new URL(uri.replace(/^mongodb(\+srv)?:/, 'http:')).host.replace(/^.*@/, '');
    } catch {
        return '?';
    }
};

const source = await mongoose.createConnection(sourceUri).asPromise();
const target = await mongoose.createConnection(targetUri).asPromise();
const Vo = target.model('VirtualOfficeListing', VirtualOfficeListingSchema);
const City = target.model('City', new mongoose.Schema({ name: String }), 'cities');

console.log(`Source: ${hostOf(sourceUri)}/${source.name}  ->  Target: ${hostOf(targetUri)}/${target.name}${apply ? '' : '  (preview)'}`);

const plans = await source.collection('virtualofficeplans').find({}).sort({ serialNumber: 1, _id: 1 }).toArray();
const imageIds = plans.flatMap((p) => (p.images || []).map((i) => i?.image)).filter(Boolean);
const imageRows = imageIds.length ? await source.collection('images').find({ _id: { $in: imageIds } }).project({ s3_link: 1, real_name: 1, name: 1 }).toArray() : [];
const imageById = new Map(imageRows.map((r) => [String(r._id), r]));

const cityIdCache = new Map();
async function cityIdOf(name) {
    const key = String(name || '').toLowerCase();
    if (!cityIdCache.has(key)) {
        const variants = { gurgaon: ['gurgaon', 'gurugram'], gurugram: ['gurugram', 'gurgaon'], bangalore: ['bangalore', 'bengaluru'] }[key] || [key];
        const row = await City.findOne({ name: { $in: variants.map((v) => new RegExp(`^${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) } }).select('_id').lean();
        cityIdCache.set(key, row?._id || null);
    }
    return cityIdCache.get(key);
}

const usedSlugs = new Set((await Vo.find({}).select('slug importRef').lean()).filter((d) => d.slug).map((d) => d.slug));
let inserted = 0;
let updated = 0;
let scrubbed = 0;
const noCity = new Set();

for (const p of plans) {
    const ref = String(p._id);
    const existing = await Vo.findOne({ importRef: ref }).lean();

    const data = {};
    for (const f of TEXT_FIELDS) {
        const v = String(p[f] ?? '').trim();
        if (BANNED.test(v)) {
            scrubbed += 1;
            data[f] = '';
        } else data[f] = v;
    }
    if (!data.spaceName || !data.city) {
        console.log(`  skip ${ref}: no name or city after clean-up`);
        continue;
    }
    data.status = String(p.status || '').toLowerCase() === 'inactive' || p.isActive === false ? 'Inactive' : 'Active';
    data.annualPriceInr = Math.max(0, Math.round(Number(p.annualPriceInr) || 0));
    data.sellingPriceInr = Math.max(0, Math.round(Number(p.sellingPriceInr) || 0));
    data.couponPercentage = data.couponCode ? Math.min(100, Math.max(0, Number(p.couponPercentage) || 0)) : 0;
    data.images = (p.images || [])
        .map((i, idx) => {
            const img = imageById.get(String(i?.image));
            const url = img?.s3_link || '';
            if (!url || BANNED.test(url)) return null;
            return { url, name: BANNED.test(img.real_name || '') ? '' : img.real_name || img.name || '', order: i.order || idx + 1 };
        })
        .filter(Boolean);
    data.cityId = await cityIdOf(data.city);
    if (!data.cityId) noCity.add(data.city);

    if (existing) {
        updated += 1;
        if (apply) {
            const doc = await Vo.findById(existing._id);
            doc.set({ ...data, updatedBy: 'import' });
            await doc.save();
        }
        continue;
    }

    const base = slugifyText(`${data.spaceName} ${data.locality} ${data.city}`) || 'virtual-office';
    let slug = base;
    for (let n = 2; usedSlugs.has(slug); n++) slug = `${base}-${n}`;
    usedSlugs.add(slug);

    inserted += 1;
    if (apply) {
        await Vo.create({ ...data, slug, importRef: ref, createdBy: 'import', updatedBy: 'import', added_on: p.added_on, updated_on: p.updated_on });
    }
}

console.log(`Plans read: ${plans.length}. New: ${inserted}. Already imported (updated): ${updated}. Brand mentions removed: ${scrubbed}.`);
if (noCity.size) console.log(`Cities not found in our City list (kept as text): ${[...noCity].sort().join(', ')}`);
console.log(apply ? `Done. ${await Vo.countDocuments()} virtual offices in the target now.` : 'Preview only. Add --apply to write.');

await source.close();
await target.close();
