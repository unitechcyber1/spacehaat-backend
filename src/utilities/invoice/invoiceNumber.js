import models from '../../models/index.js';

const InvoiceSequence = models['InvoiceSequence'];

/** Zoho-style global series: INV-000001, INV-000002, … */
export const ZOHO_INVOICE_SERIES_KEY = 'INV';

export function buildInvoiceSeriesKey(prefix = ZOHO_INVOICE_SERIES_KEY) {
    return String(prefix || ZOHO_INVOICE_SERIES_KEY).trim().toUpperCase();
}

function formatZohoInvoiceNumber(sequence) {
    return `INV-${String(sequence).padStart(6, '0')}`;
}

/**
 * Preview next number without incrementing the counter.
 */
export async function peekNextInvoiceNumber({ prefix } = {}) {
    const seriesKey = buildInvoiceSeriesKey(prefix);
    const seq = await InvoiceSequence.findOne({ series_key: seriesKey }).lean();
    const lastNumber = seq?.last_number || 0;
    const nextNumber = lastNumber + 1;
    return {
        series_key: seriesKey,
        prefix: seriesKey,
        fiscal_year: null,
        next_sequence: nextNumber,
        next_invoice_number: formatZohoInvoiceNumber(nextNumber),
        last_invoice_number: lastNumber ? formatZohoInvoiceNumber(lastNumber) : null,
        last_issued_at: seq?.updatedAt || seq?.createdAt || null,
    };
}

/** Atomically issue the next invoice number for a series. */
export async function nextInvoiceNumber({ prefix } = {}) {
    const seriesKey = buildInvoiceSeriesKey(prefix);

    const seq = await InvoiceSequence.findOneAndUpdate(
        { series_key: seriesKey },
        { $inc: { last_number: 1 } },
        { upsert: true, new: true }
    );

    return {
        series_key: seriesKey,
        prefix: seriesKey,
        fiscal_year: null,
        invoice_number: formatZohoInvoiceNumber(seq.last_number),
        sequence: seq.last_number,
    };
}
