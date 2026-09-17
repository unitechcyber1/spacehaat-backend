import { computeInvoiceTotals, getInvoicePrefixForSpaceType, getInvoiceSeriesPrefix } from './taxEngine.js';
import {
    buildSellerSnapshot,
    resolveSellerStateCode,
    resolveStateProfile,
} from './resolveBillingState.js';

const INVOICE_ELIGIBLE_SPACE_TYPES = new Set(['Coworking Space', 'Office Space', 'PG', 'Coliving Space', 'Virtual Office']);

export function isInvoiceEligibleSpaceType(spaceType) {
    return INVOICE_ELIGIBLE_SPACE_TYPES.has(spaceType);
}

export function buildIdempotencyKey({ customerId, source, periodStart }) {
    const period = periodStart ? new Date(periodStart).toISOString().slice(0, 10) : 'initial';
    return `${customerId}:${source}:${period}`;
}

export { buildSellerSnapshot, resolveSellerStateCode, resolveStateProfile };

export function buildBuyerSnapshotFromCustomer(customer, clientBilling) {
    const billing = clientBilling || {};
    return {
        billing_name: billing.billing_name || customer.client?.name,
        company_name: billing.company_name || customer.client?.company_name,
        gstin: billing.gstin,
        pan: billing.pan,
        billing_email: billing.billing_email || customer.client?.email,
        billing_phone: billing.billing_phone || customer.client?.contact,
        billing_address: billing.billing_address || {
            city: customer.location?.city,
            state: billing.place_of_supply_state,
            state_code: billing.place_of_supply_state_code,
        },
        place_of_supply_state: billing.place_of_supply_state,
        place_of_supply_state_code: billing.place_of_supply_state_code,
    };
}

/**
 * Placeholder line items — amounts entered manually by admin before issue.
 */
export function buildDefaultLineItemsFromCustomer(customer, catalogItems = []) {
    const spaceType = customer.space_type;
    const catalog = catalogItems.find((c) => c.category === 'service') || catalogItems[0];
    const city = customer.location?.city || '';
    const period = {
        period_start: customer.start_date,
        period_end: customer.lease_expire_date,
    };

    const labels = {
        'Coworking Space': 'Coworking',
        'Office Space': 'Office space',
        PG: 'PG',
        'Coliving Space': 'Coliving',
        'Virtual Office': 'Virtual office',
    };
    const label = labels[spaceType];
    if (!label) return [];

    const skuPrefix = {
        'Coworking Space': 'CW',
        'Office Space': 'OS',
        PG: 'PG',
        'Coliving Space': 'CL',
        'Virtual Office': 'VO',
    }[spaceType] || 'SH';

    return [{
        catalog_item_id: catalog?._id,
        sku: catalog?.sku || `${skuPrefix}-COMMISSION`,
        description: catalog?.name || `Commission${city ? ` — ${city}` : ''}`,
        hsn_sac: catalog?.hsn_sac || '997212',
        quantity: 1,
        unit: catalog?.unit || 'flat',
        unit_price: 0,
        discount: 0,
        tax_rate: catalog?.tax_rate ?? 18,
        is_taxable: catalog?.is_taxable !== false,
        ...period,
    }];
}

export function applyTotalsToInvoicePayload(lineItems, sellerStateCode, buyerSnapshot) {
    const buyerCode = buyerSnapshot?.place_of_supply_state_code
        || buyerSnapshot?.billing_address?.state_code;

    return computeInvoiceTotals(lineItems, {
        sellerStateCode: sellerStateCode,
        buyerStateCode: buyerCode,
    });
}

export function resolveBillingForInvoice(globalProfile, { seller_state_code } = {}) {
    const sellerStateCode = resolveSellerStateCode({
        explicitCode: seller_state_code,
        billingProfile: globalProfile,
    });
    const stateProfile = resolveStateProfile(globalProfile, sellerStateCode);
    if (!stateProfile) {
        throw new Error('No SpaceHaat state GST profile configured. Add state_profiles in billing settings.');
    }
    return {
        seller_state_code: sellerStateCode,
        stateProfile,
        sellerSnapshot: buildSellerSnapshot(globalProfile, stateProfile),
    };
}

export { getInvoicePrefixForSpaceType, getInvoiceSeriesPrefix };
