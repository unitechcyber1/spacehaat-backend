/**
 * PG URL slugs from name, locality, and city.
 * Examples:
 *   PRIME CO-LIVING + Sector 69 + Gurugram → prime-co-living-in-sector-69-gurgaon
 *   Seven Star Residency + Sector 38 + Gurugram → seven-star-residency-in-sector-38-gurgaon
 */

/** Display city → slug segment (SEO-friendly). */
const CITY_SLUG_MAP = {
    gurugram: 'gurgaon',
    gurgaon: 'gurgaon',
    'new delhi': 'delhi',
    delhi: 'delhi',
    bengaluru: 'bangalore',
    bangalore: 'bangalore',
    'navi mumbai': 'navi-mumbai',
    mumbai: 'mumbai',
    noida: 'noida',
    pune: 'pune',
    hyderabad: 'hyderabad',
    ahmedabad: 'ahmedabad',
    jaipur: 'jaipur',
    chennai: 'chennai',
    lucknow: 'lucknow',
    indore: 'indore',
    kolkata: 'kolkata',
    faridabad: 'faridabad',
    ghaziabad: 'ghaziabad',
    thane: 'thane',
    chandigarh: 'chandigarh',
    dehradun: 'dehradun',
    coimbatore: 'coimbatore',
};

export function slugifyText(text) {
    if (text == null || text === '') return '';
    return String(text)
        .toLowerCase()
        .trim()
        .replace(/&/g, ' and ')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function normalizeCitySlug(city) {
    if (city == null || city === '') return '';
    const key = String(city).trim().toLowerCase().replace(/\s+/g, ' ');
    if (CITY_SLUG_MAP[key]) return CITY_SLUG_MAP[key];
    return slugifyText(city);
}

/**
 * Build slug: {name}-in-{locality}-{city} (omit empty parts).
 */
export function buildPgSlug({ name, locality, city }) {
    const namePart = slugifyText(name);
    const localityPart = slugifyText(locality);
    const cityPart = normalizeCitySlug(city);

    const segments = [];
    if (namePart) segments.push(namePart);
    if (localityPart) {
        if (namePart) segments.push('in', localityPart);
        else segments.push(localityPart);
    }
    if (cityPart) segments.push(cityPart);

    return segments.join('-').replace(/-+/g, '-');
}

/**
 * Ensure unique slug on PG collection (appends -2, -3, … if taken).
 */
export async function allocateUniquePgSlug(PGModel, fields, { excludeId, baseSlug } = {}) {
    const base = baseSlug || buildPgSlug(fields);
    if (!base) return '';

    let candidate = base;
    let n = 2;
    while (true) {
        const filter = { slug: candidate };
        if (excludeId) filter._id = { $ne: excludeId };
        const exists = await PGModel.exists(filter);
        if (!exists) return candidate;
        candidate = `${base}-${n}`;
        n += 1;
    }
}
