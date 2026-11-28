import { Types } from 'mongoose';

/**
 * Populate that survives old records. Some 2020 coworking spaces store plan types as text ("hot-desk",
 * "day-pass") where an id is expected; a normal populate then throws a CastError and the whole Inventory
 * page (or search) fails with a 500. Here values that are not ids are set aside before populating:
 * plan types keep their text as the name ("hot desk"), other broken links are left out.
 */
const isOid = (v) => v instanceof Types.ObjectId || (typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v))
    || (v && typeof v === 'object' && v._bsontype === 'ObjectId');

const TEXT_KEY = '__text';

/** Walk `path` (dotted, through arrays) on `obj` and clean the value at the end. */
function clean(obj, parts) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
        for (const item of obj) clean(item, parts);
        return;
    }
    const [key, ...rest] = parts;
    if (!(key in obj)) return;
    if (rest.length) {
        clean(obj[key], rest);
        return;
    }
    const v = obj[key];
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) {
        obj[key] = v.filter(isOid);
    } else if (!isOid(v)) {
        if (typeof v === 'string' && v.trim()) obj[TEXT_KEY + key] = v;
        delete obj[key];
    }
}

/** Put text values back as `{ name }` so the listing shape still shows them. */
function restore(obj, parts) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
        for (const item of obj) restore(item, parts);
        return;
    }
    const [key, ...rest] = parts;
    if (rest.length) {
        restore(obj[key], rest);
        return;
    }
    const text = obj[TEXT_KEY + key];
    if (text !== undefined) {
        obj[key] = { name: String(text).replace(/[-_]+/g, ' ').trim() };
        delete obj[TEXT_KEY + key];
    }
}

/** `Model.populate(rows, populate)` without failing on records whose links are not ids. */
export async function safePopulate(Model, rows, populate) {
    const list = Array.isArray(rows) ? rows : [rows];
    const paths = populate.map((p) => (typeof p === 'string' ? p : p.path).split('.'));
    for (const doc of list) for (const parts of paths) clean(doc, parts);
    await Model.populate(list, populate);
    for (const doc of list) for (const parts of paths) restore(doc, parts);
    return rows;
}
