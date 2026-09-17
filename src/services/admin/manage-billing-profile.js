import models from '../../models/index.js';
import { normalizeStateCode } from '../../utilities/invoice/resolveBillingState.js';

const BillingProfile = models['BillingProfile'];

const DEFAULT_STATE_PROFILES = [
    {
        state_code: '06',
        state: 'Haryana',
        gstin: process.env.BILLING_GSTIN_HARYANA || '06AAECU0011C1Z7',
        address: {
            line1: process.env.BILLING_ADDRESS_LINE1 || 'SURYA, VIHAR PART-3 SECTOR-91, Sec-91, Faridabad',
            city: process.env.BILLING_CITY || 'Faridabad',
            state: 'Haryana',
            pincode: process.env.BILLING_PINCODE || '121013',
        },
        is_default: true,
    },
];

const DEFAULT_PROFILE = {
    key: 'default',
    legal_name: process.env.BILLING_LEGAL_NAME || 'Unitechcyber Technologies Pvt Ltd',
    trade_name: process.env.BILLING_TRADE_NAME || 'SpaceHaat',
    pan: process.env.BILLING_PAN || '',
    cin: process.env.BILLING_CIN || '',
    email: process.env.BILLING_EMAIL || process.env.ADMIN_EMAIL_ID || 'info@spacehaat.com',
    phone: process.env.BILLING_PHONE || '91-7017333425',
    website: process.env.BILLING_WEBSITE || 'www.spacehaat.com',
    invoice_email_cc: process.env.BILLING_INVOICE_CC
        ? process.env.BILLING_INVOICE_CC.split(',').map((e) => e.trim()).filter(Boolean)
        : [],
    invoice_email_bcc: process.env.BILLING_INVOICE_BCC
        ? process.env.BILLING_INVOICE_BCC.split(',').map((e) => e.trim()).filter(Boolean)
        : [],
    invoice_reply_to: process.env.BILLING_INVOICE_REPLY_TO || process.env.BILLING_EMAIL || '',
    bank_details: {
        account_name: process.env.BILLING_BANK_ACCOUNT_NAME || 'Unitechcyber Technologies Pvt Ltd',
        account_number: process.env.BILLING_BANK_ACCOUNT_NUMBER || '0051975807',
        ifsc: process.env.BILLING_BANK_IFSC || 'KKBK0000287',
        bank_name: process.env.BILLING_BANK_NAME || 'Kotak Mahindra Bank',
        address: {
            line1: process.env.BILLING_BANK_ADDRESS_LINE1 || 'Gurgaon - Sector 14',
            city: process.env.BILLING_BANK_CITY || 'Gurgaon',
            state: process.env.BILLING_BANK_STATE || 'Haryana',
            pincode: process.env.BILLING_BANK_PINCODE || '',
        },
    },
    invoice_prefixes: {
        client_cw: 'INV',
        client_os: 'INV',
        client_pg: 'INV',
        client_cl: 'INV',
        proforma_cw: 'INV',
        proforma_os: 'INV',
        proforma_pg: 'INV',
        proforma_cl: 'INV',
    },
    state_profiles: DEFAULT_STATE_PROFILES,
    default_payment_terms_days: 7,
    default_late_payment_interest_rate: 18,
    default_tax_rate: 18,
};

class ManageBillingProfileService {
    constructor() {
        return {
            getOrCreate: this.getOrCreate.bind(this),
            update: this.update.bind(this),
            listStateProfiles: this.listStateProfiles.bind(this),
            upsertStateProfile: this.upsertStateProfile.bind(this),
            removeStateProfile: this.removeStateProfile.bind(this),
        };
    }

    _throw(msg, code = 400) {
        throw { name: 'cofynd', code, message: msg };
    }

    async getOrCreate() {
        let doc = await BillingProfile.findOne({ key: 'default' }).lean();
        if (!doc) {
            const created = await BillingProfile.create(DEFAULT_PROFILE);
            return created.toObject();
        }
        if (!doc.state_profiles?.length) {
            doc = await BillingProfile.findOneAndUpdate(
                { key: 'default' },
                { $set: { state_profiles: DEFAULT_STATE_PROFILES } },
                { new: true }
            ).lean();
        }
        return doc;
    }

    async update(payload = {}) {
        const allowed = [
            'legal_name', 'trade_name', 'pan', 'cin', 'email', 'phone', 'website',
            'invoice_email_cc', 'invoice_email_bcc', 'invoice_reply_to',
            'bank_details', 'invoice_prefixes', 'default_payment_terms_days',
            'default_late_payment_interest_rate', 'default_tax_rate',
            'state_profiles',
        ];
        const update = {};
        for (const k of allowed) {
            if (typeof payload[k] !== 'undefined') update[k] = payload[k];
        }

        if (update.state_profiles?.length) {
            update.state_profiles = update.state_profiles.map((p) => ({
                ...p,
                state_code: normalizeStateCode(p.state_code),
            }));
            const defaultCount = update.state_profiles.filter((p) => p.is_default).length;
            if (defaultCount === 0) update.state_profiles[0].is_default = true;
        }

        const doc = await BillingProfile.findOneAndUpdate(
            { key: 'default' },
            { $set: update },
            { upsert: true, new: true }
        );
        return doc;
    }

    async listStateProfiles() {
        const profile = await this.getOrCreate();
        return profile.state_profiles || [];
    }

    async upsertStateProfile(payload) {
        const { state_code, state, gstin, address, is_default } = payload;
        if (!state_code || !state || !gstin) {
            this._throw('state_code, state, and gstin are required');
        }

        const profile = await this.getOrCreate();
        const code = normalizeStateCode(state_code);
        const profiles = [...(profile.state_profiles || [])];
        const idx = profiles.findIndex((p) => normalizeStateCode(p.state_code) === code);

        const entry = {
            state_code: code,
            state,
            gstin: gstin.trim(),
            address: address || {},
            is_default: !!is_default,
        };

        if (idx >= 0) profiles[idx] = { ...profiles[idx], ...entry };
        else profiles.push(entry);

        if (entry.is_default) {
            profiles.forEach((p) => {
                if (normalizeStateCode(p.state_code) !== code) p.is_default = false;
            });
        }

        return this.update({ state_profiles: profiles });
    }

    async removeStateProfile({ state_code }) {
        const code = normalizeStateCode(state_code);
        if (!code) this._throw('state_code is required');

        const profile = await this.getOrCreate();
        const profiles = (profile.state_profiles || []).filter(
            (p) => normalizeStateCode(p.state_code) !== code
        );
        if (!profiles.length) this._throw('Cannot remove last state profile');

        if (!profiles.some((p) => p.is_default)) profiles[0].is_default = true;
        return this.update({ state_profiles: profiles });
    }
}

export default new ManageBillingProfileService();
