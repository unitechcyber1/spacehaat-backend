export function formatMoney(n, { symbol = '₹' } = {}) {
    const amount = Number(n || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    return `${symbol}${amount}`;
}

/** PDF fonts often lack ₹ — use Rs. with non-breaking space so symbol and amount stay on one line */
export function formatMoneyPdf(n) {
    return formatMoney(n, { symbol: 'Rs.\u00A0' });
}

export function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

export function getInvoiceTitle(invoice) {
    if (invoice?.invoice_type === 'proforma') return 'PROFORMA INVOICE';
    if (invoice?.status === 'draft') return 'DRAFT INVOICE';
    return 'TAX INVOICE';
}

const ONES = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
    if (n < 20) return ONES[n];
    const word = TENS[Math.floor(n / 10)];
    return n % 10 ? `${word} ${ONES[n % 10]}` : word;
}

function threeDigits(n) {
    if (n === 0) return '';
    if (n < 100) return twoDigits(n);
    const rest = n % 100;
    return `${ONES[Math.floor(n / 100)]} Hundred${rest ? ` ${twoDigits(rest)}` : ''}`;
}

function indianIntegerToWords(num) {
    const n = Math.floor(Number(num) || 0);
    if (n === 0) return 'Zero';

    let remainder = n;
    const parts = [];

    const crore = Math.floor(remainder / 10000000);
    remainder %= 10000000;
    const lakh = Math.floor(remainder / 100000);
    remainder %= 100000;
    const thousand = Math.floor(remainder / 1000);
    remainder %= 1000;

    if (crore) parts.push(`${threeDigits(crore)} Crore`);
    if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
    if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
    if (remainder) parts.push(threeDigits(remainder));

    return parts.join(' ');
}

/** Indian currency amount in words, e.g. "Rupees Twelve Thousand and Fifty Paise Only" */
export function amountInWords(amount) {
    const totalPaise = Math.round(Number(amount || 0) * 100);
    const rupees = Math.floor(totalPaise / 100);
    const paise = totalPaise % 100;

    let words = `Rupees ${indianIntegerToWords(rupees)}`;
    if (paise > 0) words += ` and ${twoDigits(paise)} Paise`;
    return `${words} Only`;
}

export function invoicePdfFilename(invoice) {
    const num = invoice?.invoice_number || invoice?._id || 'draft';
    const safe = String(num).replace(/[^a-zA-Z0-9/_-]+/g, '-');
    return `SpaceHaat-Invoice-${safe}.pdf`;
}

/** Bill To: company name first, billing/contact name second. */
export function getBillToDisplayNames(buyer = {}) {
    const companyName = String(buyer.company_name || '').trim();
    const billingName = String(buyer.billing_name || buyer.name || '').trim();

    if (companyName) {
        return {
            companyName,
            billingName: billingName && billingName !== companyName ? billingName : null,
            primaryName: companyName,
            secondaryName: billingName && billingName !== companyName ? billingName : null,
        };
    }

    return {
        companyName: null,
        billingName: billingName || null,
        primaryName: billingName || '—',
        secondaryName: null,
    };
}

/** Address lines for Bill From — line1 and line2 only (no city/state/pincode row). */
export function invoiceAddressLines(addr) {
    if (!addr) return [];
    return [addr.line1, addr.line2].filter(Boolean);
}

/** Full single-line address for Bill To (includes city, state, pincode). */
export function formatFullAddressOneLine(addr) {
    if (!addr) return '';
    const parts = [
        addr.line1,
        addr.line2,
        addr.city,
        addr.state,
        addr.pincode,
        addr.country && addr.country !== 'India' ? addr.country : null,
    ].filter(Boolean);
    return parts.join(', ');
}

/** Bill To detail rows with field labels (Address, GSTIN, Email, Contact). */
export function formatBillToDetailLines(buyer = {}) {
    const { secondaryName } = getBillToDisplayNames(buyer);
    const lines = [];
    if (secondaryName) {
        lines.push({ label: null, value: secondaryName });
    }
    const address = formatFullAddressOneLine(buyer.billing_address);
    if (address) lines.push({ label: 'Address', value: address });
    if (buyer.gstin) lines.push({ label: 'GSTIN', value: buyer.gstin });
    if (buyer.billing_email) lines.push({ label: 'Email', value: buyer.billing_email });
    if (buyer.billing_phone) lines.push({ label: 'Contact', value: buyer.billing_phone });
    return lines;
}

/** Normalize ship-to snapshot (supports legacy name/phone/address fields). */
export function normalizeShipToParty(shipTo = {}) {
    return {
        company_name: shipTo.company_name || '',
        billing_name: shipTo.billing_name || shipTo.name || '',
        gstin: shipTo.gstin || '',
        billing_email: shipTo.billing_email || shipTo.email || '',
        billing_phone: shipTo.billing_phone || shipTo.phone || '',
        billing_address: shipTo.billing_address || shipTo.address || {},
    };
}

/** Ship To detail rows — same labels as Bill To (Address, GSTIN, Email, Contact). */
export function formatShipToDetailLines(shipTo = {}) {
    return formatBillToDetailLines(normalizeShipToParty(shipTo));
}

/** True when invoice should render a Ship To block. */
export function hasShipToSection(shipTo) {
    if (!shipTo) return false;
    const party = normalizeShipToParty(shipTo);
    const { primaryName } = getBillToDisplayNames(party);
    if (primaryName && primaryName !== '—') return true;
    return formatBillToDetailLines(party).length > 0;
}

export function getShipToDisplayName(shipTo = {}) {
    return getBillToDisplayNames(normalizeShipToParty(shipTo)).primaryName;
}

/** Line base amount before GST (qty × rate − discount). */
export function lineBaseAmount(line = {}) {
    if (line.taxable_amount != null && line.taxable_amount !== '') {
        return Math.round((Number(line.taxable_amount) + Number.EPSILON) * 100) / 100;
    }
    const qty = Number(line.quantity) || 1;
    const unit = Number(line.unit_price) || 0;
    const discount = Number(line.discount) || 0;
    return Math.round((Math.max(0, qty * unit - discount) + Number.EPSILON) * 100) / 100;
}

/** Invoice subtotal for totals block — sum of line Amount column (pre-GST). */
export function invoiceTaxableSubtotal(invoice = {}) {
    if (invoice.taxable_amount != null && invoice.taxable_amount !== '') {
        return Number(invoice.taxable_amount) || 0;
    }
    return (invoice.line_items || []).reduce((sum, line) => sum + lineBaseAmount(line), 0);
}

/** Single-line bank address from line1 + line2. */
export function formatBankAddressLine(addr) {
    return invoiceAddressLines(addr).join(', ');
}

function formatTaxRatePercent(rate) {
    return Number(rate || 0).toFixed(1);
}

/** Tax row labels for totals section, e.g. "CGST (9.0%)" / "SGST (9.0%)". */
export function getInvoiceTaxLabels(invoice) {
    const lineItems = invoice?.line_items || [];
    const rate = lineItems[0]?.tax_rate ?? invoice?.tax_rate ?? 18;
    if (invoice?.tax_mode === 'inter_state') {
        return { igst: `IGST (${formatTaxRatePercent(rate)}%)` };
    }
    const half = formatTaxRatePercent(Number(rate) / 2);
    return { cgst: `CGST (${half}%)`, sgst: `SGST (${half}%)` };
}

/** Default T&C from billing profile (payment days + late interest are dynamic). */
export function buildDefaultInvoiceTerms(billingProfile = {}) {
    const days = billingProfile.default_payment_terms_days ?? 7;
    const interestRate = billingProfile.default_late_payment_interest_rate ?? 18;
    return [
        `Payment shall be made within ${days} days from the invoice date`,
        `Delayed payments shall attract interest at ${interestRate}% per annum calculated from the due date until the date of actual payment.`,
    ].join('\n');
}

export function resolveInvoiceTerms(invoice, billingProfile) {
    if (invoice?.terms?.trim()) return invoice.terms.trim();
    return buildDefaultInvoiceTerms(billingProfile);
}
