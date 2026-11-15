/**
 * Adds coworking spaces from a prepared JSON file as PENDING drafts (never live), with their photos.
 * Made for files like "SpringHouse Gurugram/import/springhouse-gurugram.json"; each record has
 * `action` ("create draft" or "update existing listing") and a `body` in the CRM editor's format, with
 * names instead of ids (brandName, cityName, microLocationNames, amenityNames, plan typeName) and photo
 * file paths relative to the folder the JSON's parent sits in.
 *
 * Only "create draft" records are written. "update existing listing" records are printed for a person
 * to apply in the admin, because they change a live page.
 *
 * A record is skipped when a space of the same brand already exists within 150 m, or with the same name.
 *
 * Usage (on the server, from the backend folder):
 *   node src/scripts/import-workspace-drafts.js "<folder>/import/springhouse-gurugram.json"           Preview
 *   node src/scripts/import-workspace-drafts.js "<folder>/import/springhouse-gurugram.json" --apply   Save drafts
 *   add --only SHGU002,SHGU003 to limit to some records.
 *   add --allow-near SHGU006 for a centre a person has checked is a different building near another.
 *   add --update-drafts to refresh hours, plans, amenities, area and rating on drafts already created
 *   from this file (matched by name, PENDING only; photos and text are left as they are).
 */
import '../config/loadEnv.js';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import database from '../config/database.js';
import models from '../models/index.js';
import { createWorkspace, uploadWorkspaceImages, saveImageTitles, slugify } from '../crm/modules/listings/workspace-editor.js';

const CITY_SLUG = { Gurgaon: 'gurugram', Gurugram: 'gurugram' };
const L = (rec) => rec.body.location || {};

const { WorkSpace, Brand, Country, State, City, MicroLocation, Category, Amenty } = models;
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && a.endsWith('.json'));
const apply = args.includes('--apply');
const onlyArg = args.includes('--only') ? args[args.indexOf('--only') + 1] : '';
const only = new Set(onlyArg ? onlyArg.split(',').map((s) => s.trim()) : []);
// Codes checked by a person as a different centre even though the same brand is within 150 m.
const nearArg = args.includes('--allow-near') ? args[args.indexOf('--allow-near') + 1] : '';
const allowNear = new Set(nearArg ? nearArg.split(',').map((s) => s.trim()) : []);
const updateDrafts = args.includes('--update-drafts');
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** Fields the editor's create doesn't take: area, rating with its count/source; plus hours/plans/amenities for updates. */
function extraFields(rec, body) {
    const b = rec.body;
    const set = {};
    if (b.areaSqft) set.area_sqft = Number(b.areaSqft);
    if (b.rating?.value && b.rating?.count) {
        set.ratings = String(b.rating.value);
        set.ratings_count = Number(b.rating.count);
        set.ratings_source = String(b.rating.source || '');
    }
    if (b.hours) {
        set.hours_of_operation = Object.fromEntries(WEEKDAYS.map((d) => {
            const h = b.hours[d] || {};
            const open = !!h.open;
            return [d, { should_show: open, is_closed: !open, is_open_24: false, from: open ? h.from : '', to: open ? h.to : '' }];
        }));
    }
    set.plans = body.plans.map((p) => ({ category: p.type, price: Number(p.price) || 0, duration: p.per || 'month', should_show: p.show !== false, number_of_items: 1 }));
    set.starting_price = Number(b.startingPrice) || 0;
    set.amenties = body.amenities;
    return set;
}

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const byName = (Model, name, extra = {}) =>
    Model.findOne({ name: { $regex: `^\\s*${esc(name)}\\s*$`, $options: 'i' }, ...extra }).select('_id name').lean();
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function metres(a, b) {
    const r = Math.PI / 180;
    const x = (b[0] - a[0]) * r * Math.cos(((a[1] + b[1]) / 2) * r);
    const y = (b[1] - a[1]) * r;
    return 6371000 * Math.hypot(x, y);
}

async function resolve(rec, root, problems) {
    const b = rec.body;
    const L = b.location || {};
    const need = (v, what) => { if (!v) problems.push(`${what} not found`); return v ? String(v._id) : undefined; };

    const brand = need(await byName(Brand, b.brandName), `Brand "${b.brandName}"`);
    const country = need(await byName(Country, L.countryName), `Country "${L.countryName}"`);
    const state = (await byName(State, L.stateName))?._id;
    const cityDoc = (await byName(City, L.cityName)) || (await byName(City, 'Gurugram'));
    const city = need(cityDoc, `City "${L.cityName}"`);
    let micro;
    for (const n of L.microLocationNames || []) {
        micro = await byName(MicroLocation, n, city ? { city } : {});
        if (micro) break;
    }
    if (!micro) problems.push(`Area not found (tried: ${(L.microLocationNames || []).join(', ')}) - pick one in the admin`);

    const amenities = [];
    const missingAm = [];
    for (const n of b.amenityNames || []) {
        const a = await byName(Amenty, n);
        if (a) amenities.push(String(a._id)); else missingAm.push(n);
    }
    if (missingAm.length) problems.push(`amenities skipped (no such name): ${missingAm.join(', ')}`);

    const plans = [];
    for (const p of b.plans || []) {
        const c = await byName(Category, p.typeName, { active: true });
        if (c) plans.push({ type: String(c._id), price: p.price, per: p.per, show: p.show !== false });
        else problems.push(`plan type "${p.typeName}" not found`);
    }

    const photos = (b.photos || []).map((p) => path.join(root, p.file)).filter((f) => {
        if (fs.existsSync(f)) return true;
        problems.push(`photo missing: ${f}`);
        return false;
    });

    const body = {
        name: b.name,
        brand,
        spaceTag: b.spaceTag,
        seats: b.seats || 0,
        startingPrice: b.startingPrice || 0,
        description: b.description,
        newDescription: b.description,
        status: 'pending',
        isActive: true,
        location: {
            country, state: state ? String(state) : undefined, city,
            microLocation: micro ? String(micro._id) : undefined,
            name: L.name, buildingName: L.buildingName, address: L.address, floor: L.floor, postalCode: L.postalCode,
            latitude: L.latitude, longitude: L.longitude,
        },
        nearby: b.nearby?.metro ? { metro: { on: true, name: b.nearby.metro.name, distance: b.nearby.metro.distance } } : {},
        hours: b.hours || undefined,
        plans,
        amenities,
        spaceContact: b.spaceContact,
        newSeo: b.newSeo,
        seo: b.newSeo,
    };
    return { body, photos, brand };
}

async function duplicateOf(rec, brand) {
    const L = rec.body.location || {};
    const sameName = await WorkSpace.findOne({ name: { $regex: `^${esc(rec.body.name)}$`, $options: 'i' } }).select('slug').lean();
    if (sameName) return `same name as "${sameName.slug}"`;
    if (!brand || !L.latitude || allowNear.has(rec.code)) return null;
    const near = await WorkSpace.find({ brand, 'location.latitude': { $exists: true } })
        .select('slug name location.latitude location.longitude').lean();
    for (const w of near) {
        const d = metres([L.longitude, L.latitude], [w.location.longitude, w.location.latitude]);
        if (d < 150) return `same brand ${Math.round(d)} m away: "${w.slug}"`;
    }
    return null;
}

async function main() {
    if (!file || !fs.existsSync(file)) throw new Error('Give the path to the JSON file.');
    const root = path.dirname(path.dirname(path.resolve(file)));
    const records = JSON.parse(fs.readFileSync(file, 'utf8')).filter((r) => !only.size || only.has(r.code));
    await mongoose.connect(database.uri);

    let created = 0;
    for (const rec of records) {
        const problems = [];
        const { body, photos, brand } = await resolve(rec, root, problems);
        const head = `${rec.code}  ${rec.body.name}`;

        if (updateDrafts) {
            const draft = await WorkSpace.findOne({ name: { $regex: `^${esc(rec.body.name)}$`, $options: 'i' }, status: 'pending' }).select('_id slug').lean();
            if (!draft) { console.log(`\n${head}\n  no pending draft with this name - skipped`); continue; }
            for (const p of problems) console.log(`  ! ${p}`);
            const set = extraFields(rec, body);
            console.log(`\n${head}\n  ${apply ? 'UPDATED' : 'would update'} /coworking/${draft.slug}: ${Object.keys(set).join(', ')}`);
            if (apply) await WorkSpace.updateOne({ _id: draft._id }, { $set: set });
            continue;
        }
        if (rec.action !== 'create draft') {
            console.log(`\n${head}\n  EXISTING LISTING "${rec.existingSlug}" - not changed. Apply by hand in the admin if wanted:`);
            for (const c of rec.toCheck || []) console.log(`   - ${c}`);
            console.log(`   - pin ${rec.body.location.latitude}, ${rec.body.location.longitude}; address: ${rec.body.location.address}`);
            continue;
        }
        const dup = await duplicateOf(rec, brand);
        if (dup) { console.log(`\n${head}\n  SKIPPED: ${dup}`); continue; }

        console.log(`\n${head}\n  ${photos.length} photos, ${body.amenities.length} amenities, ${body.plans.length} plans`);
        for (const p of problems) console.log(`  ! ${p}`);
        for (const c of rec.toCheck || []) console.log(`  ? ${c}`);
        if (!apply || !body.brand || !body.location.country || !body.location.city) continue;

        const files = photos.map((f) => ({ originalname: path.basename(f), size: fs.statSync(f).size, buffer: fs.readFileSync(f), mimetype: MIME[path.extname(f).toLowerCase()] }));
        const uploaded = await uploadWorkspaceImages(files);
        await saveImageTitles(uploaded.map((u, i) => ({ ...u, title: `${rec.body.name} - photo ${i + 1}` })));
        const id = await createWorkspace({ ...body, photos: uploaded }, { role: 'admin' });
        // URL like the existing listings: "<space name>-<city>", without repeating the area.
        let slug = slugify(`${rec.body.name} ${CITY_SLUG[L(rec).cityName] || L(rec).cityName}`);
        if (await WorkSpace.exists({ slug, _id: { $ne: id } })) slug = `${slug}-${String(id).slice(-4)}`;
        await WorkSpace.updateOne({ _id: id }, { $set: { slug, ...extraFields(rec, body) } });
        created += 1;
        console.log(`  SAVED as pending draft ${id}  /coworking/${slug}`);
    }
    if (updateDrafts) console.log(apply ? '\nDrafts updated.' : '\nPreview only. Re-run with --apply to save.');
    else console.log(apply ? `\nCreated ${created} pending drafts. Nothing is live until approved in the admin.` : '\nPreview only. Re-run with --apply to save the drafts.');
}

main()
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
