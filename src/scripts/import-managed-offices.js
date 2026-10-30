/**
 * Imports managed offices from a JSON export (response.json: data.workspaces[])
 * into the ManagedOffice collection, in the same shape as WorkSpace.
 *
 * - Location: city / state / country / micro_location are linked to existing records
 *   (by name); an unmatched locality is kept in location.micro_location_string.
 * - Brand: matched by name or slug; created when missing; "Other Coworking" when absent.
 * - Images: downloaded and uploaded to S3 the same way the admin upload does
 *   (images/ at 1000x550 and small/images/latest_images_2024/ at 497x280),
 *   saved as Image docs and referenced as images[{ image, order }].
 * - Plans: workspace-style plans (category "Office Space", monthly price per seat).
 * - Records already imported (same source id) are skipped, so re-runs are safe.
 * - Imported offices get status "inprogress" so nothing goes live before review.
 *
 * Usage:
 *   node src/scripts/import-managed-offices.js --limit 5            Preview only.
 *   node src/scripts/import-managed-offices.js --limit 5 --apply    Write to DB + S3.
 *   Options: --file <path> (default ./response.json), --skip <n>
 */
import '../config/loadEnv.js';
import fs from 'fs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import database from '../config/database.js';
import models from '../models/index.js';
import FileUtility from '../utilities/file.js';
import { slugifyText } from '../utilities/pg-slug.js';

const { ManagedOffice, City, MicroLocation, Brand, Image } = models;

const args = process.argv.slice(2);
const argValue = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const apply = args.includes('--apply');
const file = argValue('--file', './response.json');
const limit = Number(argValue('--limit', '0')) || Infinity;
const skip = Number(argValue('--skip', '0')) || 0;

const SOURCE = 'spacewallah';
const OFFICE_SPACE_CATEGORY = new mongoose.Types.ObjectId('62833d8193f2bd4e9f1a3ceb');
const OTHER_BRAND_SLUG = 'other-coworking';
const SEAT_TYPES = { WARM_SHELL: 'warm_shell', READ_TO_MOVEIN: 'ready_to_move_in', READY_TO_MOVEIN: 'ready_to_move_in', BARE_SHELL: 'bare_shell' };
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const norm = (s) => String(s || '')
    .toLowerCase()
    .replace(/\b(gurgaon|gurugram)\b/g, '')
    .replace(/\bphase\s+v\b/g, 'phase 5').replace(/\bphase\s+iv\b/g, 'phase 4')
    .replace(/\bphase\s+iii\b/g, 'phase 3').replace(/\bphase\s+ii\b/g, 'phase 2')
    .replace(/\bphase\s+i\b/g, 'phase 1').replace(/\b(city)\s+i\b/g, '$1 1')
    .replace(/[^a-z0-9]/g, '');

const minutesToTime = (m) => {
    const h24 = Math.floor(m / 60) % 24;
    const mm = String(m % 60).padStart(2, '0');
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${String(h12).padStart(2, '0')}:${mm} ${h24 < 12 ? 'AM' : 'PM'}`;
};

function buildHours(workHours = {}) {
    const hours = {};
    DAYS.forEach((day, i) => {
        const slot = workHours[String(i)];
        hours[day] = slot
            ? { from: minutesToTime(slot.startTime), to: minutesToTime(slot.endTime), should_show: true, is_closed: false, is_open_24: slot.endTime - slot.startTime >= 1439 }
            : { from: '', to: '', should_show: true, is_closed: true, is_open_24: false };
    });
    return hours;
}

/** All image URLs of a record, de-duplicated, interior first then exterior. */
function collectImages(w) {
    const seen = new Set();
    return [...(w.managedofficeworkspace?.spaceImages || []), ...(w.spaceImages || []), ...(w.exteriorSpaceImages || [])]
        .filter((img) => img?.url && !seen.has(img.url) && seen.add(img.url));
}

async function uploadImage(url, alt) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const data = Buffer.from(await res.arrayBuffer());
    const realName = decodeURIComponent(url.split('/').pop().split('?')[0]);
    const name = crypto.randomBytes(20).toString('hex');
    const fileObj = { file: { name: realName, size: data.length, data } };
    const details = await FileUtility.saveFile(fileObj, 'image', name, 'images', true, 1000, 550);
    await FileUtility.saveFile(fileObj, 'image', name, 'small/images/latest_images_2024', true, 497, 280);
    const [doc] = await Image.insertMany([{ ...details, title: alt || undefined }]);
    return doc._id;
}

async function main() {
    await mongoose.connect(database.uri);
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const records = (raw.data?.workspaces || raw).slice(skip, skip + limit);

    const city = await City.findOne({ name: { $in: ['Gurugram', 'Gurgaon'] } }).lean();
    const cityCache = new Map();
    const resolveCity = async (name) => {
        const key = norm(name) || 'gurugram';
        if (!cityCache.has(key)) {
            const names = /gurgaon|gurugram/i.test(name) ? ['Gurugram', 'Gurgaon'] : [name];
            cityCache.set(key, await City.findOne({ name: { $in: names.map((n) => new RegExp(`^${n}$`, 'i')) } }).lean());
        }
        return cityCache.get(key) || city;
    };

    const brands = await Brand.find({}, { name: 1, slug: 1 }).lean();
    const brandByKey = new Map();
    brands.forEach((b) => { brandByKey.set(norm(b.name), b); if (b.slug) brandByKey.set(norm(b.slug), b); });
    const otherBrand = brands.find((b) => b.slug === OTHER_BRAND_SLUG);

    const summary = { created: 0, skipped: 0, brandsCreated: [], unmatchedLocalities: [], images: 0, imageErrors: 0 };

    for (const w of records) {
        if (await ManagedOffice.exists({ 'source.provider': SOURCE, 'source.id': w._id })) {
            summary.skipped++;
            console.log(`SKIP  ${w.name} (${w.slug}) already imported`);
            continue;
        }

        // ---- location
        const c = await resolveCity(w.city);
        const mls = await MicroLocation.find({ city: c._id }, { name: 1 }).lean();
        const mlByKey = new Map(mls.map((m) => [norm(m.name), m]));
        const parts = String(w.location || '').split(',').map((s) => s.trim()).filter(Boolean);
        const micro = mlByKey.get(norm(w.location)) || mlByKey.get(norm(parts[0])) || null;
        if (!micro) summary.unmatchedLocalities.push(w.location);
        const [lng, lat] = w.loc?.coordinates || [];
        const metro = (w.directions?.connectivityDetails || []).find((d) => d.connectivityType === 'METRO');

        // ---- brand
        const sourceBrand = w.brand?.name ? w.brand : null;
        let brand = sourceBrand ? (brandByKey.get(norm(sourceBrand.name)) || brandByKey.get(norm(sourceBrand.slug))) : otherBrand;
        if (!brand && sourceBrand) {
            const doc = {
                name: sourceBrand.name,
                slug: sourceBrand.slug || slugifyText(sourceBrand.name),
                type: 'coworking',
                cities: [c._id],
                seo: {
                    title: `${sourceBrand.name} Managed Office & Coworking Spaces`,
                    description: `Explore ${sourceBrand.name} managed offices and coworking spaces. Compare locations, seat prices and amenities.`
                }
            };
            brand = apply ? (await Brand.create(doc)).toObject() : { ...doc, _id: '(new)' };
            brandByKey.set(norm(brand.name), brand);
            summary.brandsCreated.push(brand.name);
        }

        // ---- images
        const sourceImages = collectImages(w);
        const images = [];
        if (apply) {
            for (const img of sourceImages) {
                try {
                    images.push({ image: await uploadImage(img.url, img.alt), order: images.length + 1 });
                    summary.images++;
                } catch (e) {
                    summary.imageErrors++;
                    console.warn(`  image failed: ${img.url} -> ${e.message}`);
                }
            }
        }

        // ---- plans (workspace style)
        const plans = (w.managedofficepriceplans || []).map((p) => ({
            category: OFFICE_SPACE_CATEGORY,
            seat_type: SEAT_TYPES[p.seatType] || undefined,
            duration: 'month',
            price: p.pricePerSeat || 0,
            number_of_items: 1,
            should_show: (p.pricePerSeat || 0) > 0
        }));

        const layout = w.propertyLayout || {};
        const terms = w.managedofficeworkspace?.purchaseTerms || {};
        const review = (w.managedofficeworkspace?.reviewSummary || [])[0];
        let slug = w.slug || slugifyText(`${w.name} ${w.location}`);
        if (await ManagedOffice.exists({ slug })) slug = `${slug}-${String(w._id).slice(-4)}`;

        const doc = {
            name: w.name,
            description: w.about || '',
            slug,
            images,
            amenties: [],
            location: {
                name: '',
                address1: [w.buildingName, w.location, c.name].filter(Boolean).join(', '),
                building_name: w.buildingName || '',
                country: c.country,
                state: c.state,
                city: c._id,
                micro_location: micro?._id,
                micro_location_string: micro ? micro.name : w.location,
                landmark: w.directions?.landmark || '',
                metro_stop_landmark: metro ? [metro.station, metro.lineName].filter(Boolean).join(', ') : '',
                metro_stop_distance: metro?.distance != null ? `${metro.distance} m` : '',
                latitude: lat,
                longitude: lng,
                is_near_metro: Boolean(metro)
            },
            geometry: lat != null ? { type: 'Point', coordinates: [lng, lat] } : undefined,
            hours_of_operation: buildHours(w.workHours),
            plans,
            building: {
                total_floors: layout.totalBuildingFloors,
                super_area: layout.superArea,
                total_seats: layout.totalSeating,
                floors: (layout.includedFloors || []).map((f) => ({ floor_number: f.floorNumber, area: f.area ?? undefined, seats: f.seating ?? undefined }))
            },
            lease_terms: {
                min_seats: terms.minLeaseSeats ?? terms.minLeaseUnit?.value,
                min_duration_months: terms.minLeaseDurationInMonths
            },
            rating: review ? { source: review.source, average: review.avgRating, total: review.totalRatings } : undefined,
            centre_type: w.managedofficeworkspace?.centreType === 'COWORKING' ? 'coworking' : 'managed_office',
            is_new_launch: Boolean(w.isNewLaunch),
            no_of_seats: layout.totalSeating,
            brand: brand?._id,
            status: 'inprogress',
            priority: {
                overall: { is_active: false, order: 1000 },
                location: { city: c._id, is_active: false, order: 1000 },
                micro_location: { name: micro?._id, city: c._id, is_active: false, order: 1000 }
            },
            source: {
                provider: SOURCE,
                id: String(w._id),
                slug: w.slug,
                amenities: (w.managedofficeworkspace?.amenities || []).map((a) => ({ id: a.amenity, is_paid: Boolean(a.isPaid), details: a.details || [] }))
            }
        };

        if (apply) await ManagedOffice.create(doc);
        summary.created++;
        console.log(`${apply ? 'SAVE ' : 'PLAN '} ${w.name} | ${doc.location.micro_location_string}${micro ? '' : ' (no micro location match)'} | brand: ${brand?.name || '-'} | plans: ${plans.map((p) => `${p.seat_type} ₹${p.price}`).join(', ')} | images: ${apply ? images.length : sourceImages.length}`);
    }

    console.log('\nSummary', JSON.stringify(summary, null, 2));
    if (!apply) console.log('\nPreview only. Re-run with --apply to write to the database and S3.');
    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
});
