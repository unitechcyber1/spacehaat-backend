/** City name (normalized) → 3-letter prefix for pg_id */
export const CITY_PREFIX_MAP = {
    delhi: 'DEL',
    'new delhi': 'DEL',
    gurugram: 'GGN',
    gurgaon: 'GGN',
    noida: 'NOI',
    mumbai: 'MUM',
    'navi mumbai': 'NAV',
    pune: 'PUN',
    bengaluru: 'BLR',
    bangalore: 'BLR',
    hyderabad: 'HYD',
    ahmedabad: 'AMD',
    jaipur: 'JAI',
    chennai: 'CHE',
    lucknow: 'LKO',
    indore: 'IND',
    kolkata: 'CCU',
    faridabad: 'FBD',
    ghaziabad: 'GZB',
    thane: 'THA',
    chandigarh: 'CHD',
    dehradun: 'DDN',
    coimbatore: 'CBE',
    bhopal: 'BHO',
    surat: 'SUR',
    vadodara: 'VAD',
    nagpur: 'NAG',
    kochi: 'KOC',
    visakhapatnam: 'VTZ',
    bhubaneswar: 'BBI',
    patna: 'PAT',
    ranchi: 'RAN',
    raipur: 'RPR',
    vijayawada: 'VJA',
    kanpur: 'KNP',
    meerut: 'MRT',
    nashik: 'NSK',
    amritsar: 'ATQ',
    ludhiana: 'LUH',
    jalandhar: 'JLR',
    mysuru: 'MYQ',
    mysore: 'MYQ',
    gwalior: 'GWL',
    kota: 'KTU',
    udaipur: 'UDR',
    jodhpur: 'JDH',
    prayagraj: 'ALD',
    varanasi: 'VNS',
    agra: 'AGR',
    aligarh: 'ALI',
    mathura: 'MTH',
    haridwar: 'HRW',
    roorkee: 'RKE',
    siliguri: 'IXB',
    dhanbad: 'DBD',
    asansol: 'ASN',
    durgapur: 'DGP',
    warangal: 'WGC',
    tirupati: 'TIR',
    dharwad: 'DWR',
    belagavi: 'IXG',
    kolhapur: 'KLH',
    guntur: 'GNT',
    nellore: 'NLR',
    bareilly: 'BEK',
    hisar: 'HSS',
    sonipat: 'SNP',
    panipat: 'PNP',
    karnal: 'KNU',
    ambala: 'UMB',
    bikaner: 'BKB',
    ratlam: 'RTM',
    muzaffarpur: 'MZU',
};

const COLIVING_NAME_RE = /co[\s-]?living|coliving/i;

export function normalizeCityKey(city) {
    if (city == null || city === '') return '';
    return String(city).trim().toLowerCase().replace(/\s+/g, ' ');
}

export function cityToPrefix(city) {
    const key = normalizeCityKey(city);
    if (CITY_PREFIX_MAP[key]) return CITY_PREFIX_MAP[key];
    if (!key) return 'UNK';
    const letters = key.replace(/[^a-z]/g, '');
    return (letters.slice(0, 3) || 'UNK').toUpperCase().padEnd(3, 'X');
}

/** PG vs coliving segment for pg_id (CL vs PG). */
export function propertyTypeSegment(pg) {
    const name = pg?.name ? String(pg.name) : '';
    return COLIVING_NAME_RE.test(name) ? 'CL' : 'PG';
}

export function formatPgId(prefix, typeSegment, sequence) {
    const seq = String(sequence).padStart(4, '0');
    return `${prefix}-${typeSegment}-${seq}`;
}

export function isColivingProperty(pg) {
    return propertyTypeSegment(pg) === 'CL';
}

/** Next pg_id for a city + property (PG/CL), based on existing ids with same prefix. */
export async function allocateNextPgId(PGModel, { city, name }) {
    const prefix = cityToPrefix(city);
    const typeSeg = propertyTypeSegment({ name });
    const pattern = new RegExp(`^${prefix}-${typeSeg}-(\\d{4})$`);
    const existing = await PGModel.find({ pg_id: new RegExp(`^${prefix}-${typeSeg}-`) })
        .select('pg_id')
        .lean();
    let max = 0;
    for (const row of existing) {
        const m = String(row.pg_id || '').match(pattern);
        if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return formatPgId(prefix, typeSeg, max + 1);
}
