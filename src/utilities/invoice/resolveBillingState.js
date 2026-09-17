/** Resolve Cofynd seller GST profile by state code */

export function normalizeStateCode(code) {
    if (code == null || code === '') return null;
    const s = String(code).trim();
    if (/^\d{1,2}$/.test(s)) return s.padStart(2, '0');
    return s;
}

export function resolveStateProfile(billingProfile, stateCode) {
    const profiles = Array.isArray(billingProfile?.state_profiles)
        ? billingProfile.state_profiles
        : [];

    const normalized = normalizeStateCode(stateCode);
    if (normalized) {
        const match = profiles.find(
            (p) => normalizeStateCode(p.state_code) === normalized
        );
        if (match) return match;
    }

    const defaultProfile = profiles.find((p) => p.is_default);
    if (defaultProfile) return defaultProfile;

    return profiles[0] || null;
}

/**
 * Which Cofynd state GST to use when issuing an invoice.
 * Priority: explicit seller_state_code → env default → billing default state profile.
 */
export function resolveSellerStateCode({ explicitCode, billingProfile }) {
    if (explicitCode) return normalizeStateCode(explicitCode);

    const envDefault = process.env.BILLING_DEFAULT_STATE_CODE;
    if (envDefault) return normalizeStateCode(envDefault);

    const profiles = billingProfile?.state_profiles || [];
    const defaultProfile = profiles.find((p) => p.is_default) || profiles[0];
    return defaultProfile ? normalizeStateCode(defaultProfile.state_code) : null;
}

export function buildSellerSnapshot(globalProfile, stateProfile) {
    if (!globalProfile) return {};
    const state = stateProfile || {};

    return {
        supplier: 'SpaceHaat',
        legal_name: globalProfile.legal_name,
        trade_name: globalProfile.trade_name || globalProfile.legal_name,
        gstin: state.gstin || globalProfile.gstin,
        pan: globalProfile.pan,
        cin: globalProfile.cin,
        email: globalProfile.email,
        phone: globalProfile.phone,
        website: globalProfile.website,
        address: {
            line1: state.address?.line1 || globalProfile.address?.line1,
            line2: state.address?.line2 || globalProfile.address?.line2,
            city: state.address?.city || globalProfile.address?.city,
            state: state.state || globalProfile.address?.state,
            state_code: normalizeStateCode(state.state_code || globalProfile.address?.state_code),
            pincode: state.address?.pincode || globalProfile.address?.pincode,
            country: 'India',
        },
        bank_details: globalProfile.bank_details,
    };
}
