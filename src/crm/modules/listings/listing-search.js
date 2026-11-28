import models from '../../../models/index.js';
import { aliasesOf, escape } from './workspace-listings.js';

/**
 * Inventory search box, shared by every section. The text is split into words and every word must match
 * somewhere on the property: its name, address, area, landmark, web address, or the names of its city,
 * locality and brand (those are stored as links, so they are looked up first). So "awfis sohna road gurgaon",
 * "91springboard sector 44" and "pg in lajpat nagar delhi" all work.
 *   - Letters may be split by spaces, dots or dashes: "springboard" also finds "Spring Board",
 *     "sector44" finds "Sector 44".
 *   - City spellings: Gurgaon = Gurugram, Bangalore = Bengaluru, Delhi = New Delhi.
 *   - Small words (in, at, near…) are skipped; words that only name the section ("coworking", "pg", "office")
 *     are skipped too unless they are the whole search.
 */
const { City, MicroLocation, Brand } = models;

const STOP_WORDS = new Set(['in', 'at', 'near', 'the', 'of', 'and', 'for', 'by', 'to', 'on', 'with']);
const SECTION_WORDS = new Set([
    'coworking', 'cowork', 'co', 'working', 'space', 'spaces', 'office', 'offices', 'pg', 'pgs', 'coliving',
    'hostel', 'virtual', 'managed', 'private', 'workspace', 'workspaces',
]);
const MAX_WORDS = 8;

/** The words of a search, lower-case, punctuation removed. */
export function searchWords(search) {
    const words = String(search || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .split(' ')
        .filter((w) => w && !STOP_WORDS.has(w));
    const specific = words.filter((w) => !SECTION_WORDS.has(w));
    return [...new Set(specific.length ? specific : words)].slice(0, MAX_WORDS);
}

/** One word, letters allowed to be split by spaces / dots / dashes; city words also match their other spelling. */
export function wordRegex(word) {
    const loose = (w) => [...w].map(escape).join('[\\s._/-]*');
    const variants = [...new Set([word, ...aliasesOf(word)])].filter(Boolean);
    return new RegExp(variants.map(loose).join('|'), 'i');
}

const refCache = new Map();
const REF_TTL = 10 * 60e3;

/** Ids of cities, localities and brands whose name contains the word (cached: the same words repeat a lot). */
async function refIdsFor(word) {
    const hit = refCache.get(word);
    if (hit && hit.at > Date.now() - REF_TTL) return hit.ids;
    const re = wordRegex(word);
    const [cities, micros, brands] = await Promise.all([
        City.find({ name: re }).select('_id').limit(50).lean(),
        MicroLocation.find({ name: re }).select('_id').limit(400).lean(),
        Brand.find({ name: re }).select('_id').limit(200).lean(),
    ]);
    const ids = { cities: cities.map((d) => d._id), micros: micros.map((d) => d._id), brands: brands.map((d) => d._id) };
    if (refCache.size > 500) refCache.clear();
    refCache.set(word, { at: Date.now(), ids });
    return ids;
}

/**
 * Query clauses (all must match) for a search over a collection.
 * `text`: string fields; `city` / `micro` / `brand`: fields holding a City / MicroLocation / Brand id (or ids).
 */
export async function searchClauses(search, { text = [], city, micro, brand } = {}) {
    const words = searchWords(search);
    const clauses = [];
    for (const word of words) {
        const re = wordRegex(word);
        const or = text.map((field) => ({ [field]: re }));
        if (city || micro || brand) {
            const ids = await refIdsFor(word);
            if (city && ids.cities.length) or.push({ [city]: { $in: ids.cities } });
            if (micro && ids.micros.length) or.push({ [micro]: { $in: ids.micros } });
            if (brand && ids.brands.length) or.push({ [brand]: { $in: ids.brands } });
        }
        clauses.push({ $or: or });
    }
    return clauses;
}
