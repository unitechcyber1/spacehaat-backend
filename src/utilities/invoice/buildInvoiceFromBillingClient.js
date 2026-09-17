import { computeInvoiceTotals } from './taxEngine.js';

export function buildBuyerSnapshotFromBillingClient(client) {
    if (!client) return {};
    return {
        billing_name: client.billing_name,
        company_name: client.company_name,
        gstin: client.gstin,
        pan: client.pan,
        billing_email: client.billing_email,
        billing_phone: client.billing_phone,
        billing_address: client.billing_address || {},
        place_of_supply_state: client.place_of_supply_state || client.billing_address?.state,
        place_of_supply_state_code: client.place_of_supply_state_code || client.billing_address?.state_code,
    };
}

/** Ship-to snapshot uses the same party shape as Bill To for shared formatting. */
export function buildShipToSnapshotFromBillingClient(client) {
    if (!client || client.ship_to_same_as_billing !== false) return null;

    const address = client.shipping_address || {};
    const party = {
        company_name: String(client.ship_to_company_name || '').trim(),
        billing_name: String(client.ship_to_name || '').trim(),
        gstin: String(client.ship_to_gstin || '').trim(),
        billing_email: String(client.ship_to_email || '').trim(),
        billing_phone: String(client.ship_to_phone || '').trim(),
        billing_address: address,
    };

    const hasAddress = !!(address.line1 || address.line2 || address.city || address.pincode);
    const hasContent = !!(
        party.company_name
        || party.billing_name
        || party.gstin
        || party.billing_email
        || party.billing_phone
        || hasAddress
    );
    if (!hasContent) return null;

    return party;
}

export function buildBillingSnapshotFromBillingClient(client, sellerSnapshot) {
    const snapshot = {
        seller: sellerSnapshot,
        buyer: buildBuyerSnapshotFromBillingClient(client),
    };
    const shipTo = buildShipToSnapshotFromBillingClient(client);
    if (shipTo) snapshot.ship_to = shipTo;
    return snapshot;
}

export function buildIdempotencyKeyForBillingClient({ billingClientId, source, periodStart }) {
    const period = periodStart ? new Date(periodStart).toISOString().slice(0, 10) : 'manual';
    return `bc:${billingClientId}:${source}:${period}`;
}

export function buildDefaultLineItemsForBillingClient({ space_type, catalogItems = [] }) {
    const catalog = catalogItems.find((c) => c.category === 'service') || catalogItems[0];
    const labels = {
        'Coworking Space': 'Coworking commission',
        'Office Space': 'Office space commission',
        PG: 'PG commission',
        'Coliving Space': 'Coliving commission',
        'Virtual Office': 'Virtual office commission',
    };
    const skuMap = {
        'Coworking Space': 'CW-COMMISSION',
        'Office Space': 'OS-COMMISSION',
        PG: 'PG-COMMISSION',
        'Coliving Space': 'CL-COMMISSION',
        'Virtual Office': 'VO-COMMISSION',
    };
    const label = labels[space_type] || 'Commission';

    return [{
        catalog_item_id: catalog?._id,
        sku: catalog?.sku || skuMap[space_type] || 'SH-COMMISSION',
        description: catalog?.name || label,
        hsn_sac: catalog?.hsn_sac || '997212',
        quantity: 1,
        unit: catalog?.unit || 'flat',
        unit_price: 0,
        discount: 0,
        tax_rate: catalog?.tax_rate ?? 18,
        is_taxable: catalog?.is_taxable !== false,
    }];
}

export function applyTotalsToBillingClientInvoice(lineItems, sellerStateCode, billingClient) {
    const buyer = buildBuyerSnapshotFromBillingClient(billingClient);
    const buyerCode = buyer.place_of_supply_state_code || buyer.billing_address?.state_code;
    return computeInvoiceTotals(lineItems, {
        sellerStateCode,
        buyerStateCode: buyerCode,
    });
}
