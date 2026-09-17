/** GST tax calculation for invoice line items */

import { normalizeStateCode } from './resolveBillingState.js';

function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * @param {object} opts
 * @param {string} opts.sellerStateCode - e.g. '07' for Delhi
 * @param {string} opts.buyerStateCode
 * @param {Array} opts.lineItems - { quantity, unit_price, discount, tax_rate, is_taxable }
 */
export function computeLineTax(line, taxMode) {
    const qty = Number(line.quantity) || 1;
    const unitPrice = Number(line.unit_price) || 0;
    const discount = Number(line.discount) || 0;
    const taxRate = Number(line.tax_rate) || 0;
    const isTaxable = line.is_taxable !== false;

    const gross = round2(qty * unitPrice);
    const taxable = round2(Math.max(0, gross - discount));

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isTaxable && taxRate > 0) {
        const taxAmount = round2(taxable * taxRate / 100);
        if (taxMode === 'inter_state') {
            igst = taxAmount;
        } else {
            cgst = round2(taxAmount / 2);
            sgst = round2(taxAmount / 2);
        }
    }

    const lineTotal = round2(taxable + cgst + sgst + igst);

    return {
        ...line,
        taxable_amount: taxable,
        cgst,
        sgst,
        igst,
        line_total: lineTotal,
    };
}

export function resolveTaxMode(sellerStateCode, buyerStateCode) {
    if (!sellerStateCode || !buyerStateCode) return 'intra_state';
    const s = String(sellerStateCode).trim().padStart(2, '0');
    const b = String(buyerStateCode).trim().padStart(2, '0');
    return s === b ? 'intra_state' : 'inter_state';
}

export function computeInvoiceTotals(lineItems, { sellerStateCode, buyerStateCode } = {}) {
    const taxMode = resolveTaxMode(sellerStateCode, buyerStateCode);
    const computedLines = lineItems.map((line) => computeLineTax(line, taxMode));

    const subtotal = round2(computedLines.reduce((s, l) => s + (Number(l.quantity) || 1) * (Number(l.unit_price) || 0), 0));
    const discountTotal = round2(computedLines.reduce((s, l) => s + (Number(l.discount) || 0), 0));
    const taxableAmount = round2(computedLines.reduce((s, l) => s + (Number(l.taxable_amount) || 0), 0));
    const cgst = round2(computedLines.reduce((s, l) => s + (Number(l.cgst) || 0), 0));
    const sgst = round2(computedLines.reduce((s, l) => s + (Number(l.sgst) || 0), 0));
    const igst = round2(computedLines.reduce((s, l) => s + (Number(l.igst) || 0), 0));
    const total = round2(computedLines.reduce((s, l) => s + (Number(l.line_total) || 0), 0));

    return {
        tax_mode: taxMode,
        line_items: computedLines,
        subtotal,
        discount_total: discountTotal,
        taxable_amount: taxableAmount,
        cgst,
        sgst,
        igst,
        total,
        balance_due: total,
    };
}

export function getFiscalYearLabel(date = new Date()) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    if (month >= 4) {
        return `${String(year).slice(-2)}${String(year + 1).slice(-2)}`;
    }
    return `${String(year - 1).slice(-2)}${String(year).slice(-2)}`;
}

export function getInvoicePrefixForSpaceType(billingProfile, spaceType, invoiceType = 'client') {
    void billingProfile;
    void spaceType;
    void invoiceType;
    return 'INV';
}

/** Zoho-style global invoice series: INV-000001 */
export function getInvoiceSeriesPrefix() {
    return 'INV';
}
