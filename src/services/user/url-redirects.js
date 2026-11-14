import models from '../../models/index.js';
import { slugifyText } from '../../utilities/pg-slug.js';

/**
 * What the website should do with old listing URLs, per vertical:
 *   { to: '<live slug>' }   → permanent redirect (renamed listing, or a hidden duplicate of a live one)
 *   { gone: true, city }    → 410 Gone (listing removed on purpose; `city` names the city page to suggest)
 *
 * Safety rule: a slug that is live right now is NEVER in this map, whatever its history says, so a live
 * page can never be redirected or marked gone. Unknown slugs are not listed (they stay plain 404s).
 */
const { PG, WorkSpace, ManagedOffice, City } = models;

/** Same rule as the public PG API (services/user/manage-pg.js publicPgFilter). */
const PUBLIC_PG = { delete: { $ne: true }, active: true, status: 'approve' };
/** Coworking and managed office detail pages show only approved listings. */
const APPROVED = { status: 'approve' };

const clean = (s) => (typeof s === 'string' ? s.trim() : '');

async function citySlugs() {
    const rows = await City.find({}).select('name').lean();
    const out = new Set(['gurgaon', 'gurugram', 'bangalore', 'bengaluru', 'delhi', 'new-delhi', 'mumbai', 'navi-mumbai']);
    for (const r of rows) {
        const s = slugifyText(r.name);
        if (s) out.add(s);
    }
    return out;
}

/** Build one vertical's map from its live rows and its hidden rows. */
function buildMap({ live, hidden, cityOf, reserved, targetOf }) {
    const liveSlugs = new Set(live.map((r) => clean(r.slug)).filter(Boolean));
    const liveById = new Map(live.map((r) => [String(r._id), clean(r.slug)]));
    const map = {};
    const put = (slug, entry) => {
        const s = clean(slug);
        // Never touch a live URL or a city page; first decision wins (redirects are added before 410s).
        if (!s || liveSlugs.has(s) || reserved.has(s) || map[s]) return;
        map[s] = entry;
    };

    // 1. Earlier URLs of live listings → their current URL.
    for (const r of live) {
        for (const old of r.previous_slugs || []) put(old, { to: clean(r.slug) });
    }
    // 2. Hidden listings that duplicate a live one → that live listing.
    for (const r of hidden) {
        const target = targetOf ? liveById.get(String(targetOf(r) || '')) : '';
        if (!target) continue;
        put(r.slug, { to: target });
        for (const old of r.previous_slugs || []) put(old, { to: target });
    }
    // 3. Every other hidden listing → gone.
    for (const r of hidden) {
        const entry = { gone: true, ...(cityOf(r) ? { city: cityOf(r) } : {}) };
        put(r.slug, entry);
        for (const old of r.previous_slugs || []) put(old, entry);
    }
    return map;
}

async function compute() {
    const reserved = await citySlugs();
    const [pgLive, pgHidden, wsLive, wsHidden, moLive, moHidden] = await Promise.all([
        PG.find(PUBLIC_PG).select('slug previous_slugs').lean(),
        PG.find({ $nor: [PUBLIC_PG], slug: { $nin: [null, ''] } }).select('slug previous_slugs duplicate_of city').lean(),
        WorkSpace.find(APPROVED).select('slug previous_slugs').lean(),
        WorkSpace.find({ status: { $ne: 'approve' }, slug: { $nin: [null, ''] } })
            .select('slug previous_slugs location.city')
            .populate('location.city', 'name')
            .lean(),
        ManagedOffice.find(APPROVED).select('slug previous_slugs').lean(),
        ManagedOffice.find({ status: { $ne: 'approve' }, slug: { $nin: [null, ''] } })
            .select('slug previous_slugs location.city')
            .populate('location.city', 'name')
            .lean(),
    ]);

    const cityName = (r) => clean(r.location?.city?.name);
    return {
        generatedAt: new Date().toISOString(),
        coliving: buildMap({ live: pgLive, hidden: pgHidden, cityOf: (r) => clean(r.city), reserved, targetOf: (r) => r.duplicate_of }),
        coworking: buildMap({ live: wsLive, hidden: wsHidden, cityOf: cityName, reserved }),
        managedOffice: buildMap({ live: moLive, hidden: moHidden, cityOf: cityName, reserved }),
    };
}

let cache = null;
/** Cached for 5 minutes: re-approving a listing takes effect on the website within ~15 minutes. */
export async function getUrlRedirects() {
    if (cache && cache.at > Date.now() - 5 * 60e3) return cache.data;
    const data = await compute();
    cache = { at: Date.now(), data };
    return data;
}

export const _test = { buildMap, compute };
