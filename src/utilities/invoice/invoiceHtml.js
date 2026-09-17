import {
    amountInWords,
    formatBankAddressLine,
    formatBillToDetailLines,
    formatDate,
    formatMoney,
    formatMoneyPdf,
    formatShipToDetailLines,
    getBillToDisplayNames,
    getInvoiceTaxLabels,
    getInvoiceTitle,
    getShipToDisplayName,
    hasShipToSection,
    invoiceAddressLines,
    invoiceTaxableSubtotal,
    lineBaseAmount,
} from './invoiceFormat.js';
import { getSpacehaatLogoBase64 } from './invoiceAssets.js';

const BRAND = '#4CAF50';
const BRAND_SOFT = '#E8F5E9';
const BRAND_INK = '#2E7D32';

function esc(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatAddress(addr) {
    return invoiceAddressLines(addr).map((p) => esc(p)).join('<br>');
}

function formatDetailLinesHtml(lines) {
    return lines.map((row) => {
        if (!row.label) return `${esc(row.value)}<br>`;
        return `${esc(row.label)}: ${esc(row.value)}<br>`;
    }).join('');
}

function formatMultiline(value) {
    return esc(value).replace(/\r\n|\r|\n/g, '<br>');
}

function formatPosLabel(buyer) {
    const state = buyer.place_of_supply_state || buyer.billing_address?.state || '';
    const code = buyer.place_of_supply_state_code || buyer.billing_address?.state_code || '';
    if (state && code) return `${state} (${code})`;
    return state || code || '—';
}

function formatTermsBlock(terms) {
    if (!terms?.trim()) return '';
    const clauses = terms.split('\n').map((t) => t.trim()).filter(Boolean);
    return `
      <div class="inv-terms-block">
        <p class="inv-terms-title">Terms &amp; conditions</p>
        ${clauses.map((t) => `<p class="inv-terms">${esc(t)}</p>`).join('')}
      </div>`;
}

const BASE_STYLES = `
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #333;
    background: #f4f4f4;
    font-size: 13px;
    line-height: 1.45;
    -webkit-font-smoothing: antialiased;
  }
  .inv-page {
    max-width: 820px;
    margin: 0 auto;
    background: #fff;
    box-shadow: 0 4px 24px rgba(17, 24, 39, 0.08);
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }
  .inv-sheet-accent { height: 4px; background: linear-gradient(90deg, ${BRAND} 0%, ${BRAND_INK} 100%); }
  .inv-body { padding: 28px 32px 32px; }
  .inv-top {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 24px;
    align-items: start;
    margin-bottom: 8px;
  }
  .inv-logo { height: 42px; width: auto; max-width: 200px; object-fit: contain; display: block; margin-bottom: 12px; }
  .inv-brand-fallback { margin: 0 0 12px; font-size: 28px; font-weight: 800; color: ${BRAND}; letter-spacing: -0.02em; }
  .inv-seller-lines { font-size: 12px; color: #555; line-height: 1.55; }
  .inv-seller-lines strong { color: #222; font-size: 13px; display: block; margin-bottom: 4px; font-weight: 700; }
  .inv-doc-side { text-align: right; min-width: 220px; }
  .inv-doc-title {
    margin: 0 0 12px;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #222;
  }
  .inv-meta-row { font-size: 12px; margin-bottom: 4px; color: #555; }
  .inv-meta-row span { color: #888; margin-right: 6px; }
  .inv-meta-row b { color: #222; font-weight: 600; }
  .inv-parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    margin: 20px 0 16px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }
  .inv-party-col {
    padding: 14px 16px;
    min-width: 0;
    background: #fafafa;
  }
  .inv-party-col + .inv-party-col { border-left: 1px solid #e5e7eb; }
  .inv-party-label {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: ${BRAND_INK};
  }
  .inv-party-name { margin: 0 0 6px; font-size: 13px; font-weight: 700; color: #222; word-break: break-word; }
  .inv-party-lines { font-size: 12px; color: #444; line-height: 1.55; word-break: break-word; }
  .inv-table-wrap { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-top: 8px; }
  table.inv-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .inv-table thead tr { background: ${BRAND_SOFT}; border-bottom: 2px solid ${BRAND}; }
  .inv-table th {
    padding: 9px 10px;
    text-align: left;
    font-size: 11px;
    font-weight: 700;
    color: ${BRAND_INK};
    border-bottom: 1px solid ${BRAND};
  }
  .inv-table th.num, .inv-table td.num {
    text-align: right;
    white-space: nowrap;
    word-break: normal;
    overflow-wrap: normal;
    font-variant-numeric: tabular-nums;
  }
  .inv-table th.center, .inv-table td.center { text-align: center; }
  .inv-table td {
    padding: 10px;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: top;
    color: #333;
    word-break: break-word;
  }
  .inv-table td.num { word-break: normal; overflow-wrap: normal; }
  .inv-table tbody tr:nth-child(even) td { background: #fcfcfd; }
  .inv-table tbody tr:last-child td { border-bottom: none; }
  .inv-bottom {
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: 20px;
    margin-top: 16px;
    align-items: start;
  }
  .inv-bank-block { font-size: 12px; color: #444; line-height: 1.6; }
  .inv-bank-title { margin: 0 0 6px; font-weight: 700; color: #222; }
  .inv-totals { border: 1px solid #e5e7eb; border-radius: 8px; padding: 0; overflow: hidden; }
  .inv-total-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 14px;
    font-size: 12px;
    border-bottom: 1px solid #f3f4f6;
    color: #555;
  }
  .inv-total-row:last-child { border-bottom: none; }
  .inv-total-row strong {
    color: #111827;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    word-break: normal;
    overflow-wrap: normal;
  }
  .inv-total-row.grand {
    background: linear-gradient(135deg, ${BRAND} 0%, ${BRAND_INK} 100%);
    font-size: 14px;
    font-weight: 700;
    padding: 10px 14px;
    color: #fff;
    border-bottom: none;
  }
  .inv-total-row.grand strong { color: #fff; }
  .inv-words {
    margin-top: 14px;
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
    border-left: 4px solid ${BRAND};
    border-radius: 6px;
    background: #fafafa;
    font-size: 12px;
    font-weight: 600;
    color: #333;
    line-height: 1.55;
  }
  .inv-notes { margin-top: 14px; font-size: 12px; color: #555; }
  .inv-notes-title { font-weight: 700; color: #222; margin-bottom: 4px; }
  .inv-terms-block { margin-top: 14px; }
  .inv-terms-title { margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #222; }
  .inv-terms { margin: 0 0 6px; font-size: 11.5px; line-height: 1.55; color: #555; }
  .inv-terms:last-child { margin-bottom: 0; }
  .inv-signature {
    margin-top: 32px;
    text-align: right;
    font-size: 12px;
    color: #555;
  }
  .inv-signature-line {
    display: inline-block;
    min-width: 180px;
    border-top: 1px solid #999;
    padding-top: 6px;
    margin-top: 40px;
  }
  .inv-generated {
    margin-top: 20px;
    padding-top: 14px;
    border-top: 1px solid #e5e7eb;
    font-size: 10.5px;
    color: #9ca3af;
    text-align: center;
    line-height: 1.5;
  }
  .no-print { }
  @media print {
    body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .inv-page { box-shadow: none; border: none; border-radius: 0; max-width: none; }
    .no-print { display: none !important; }
  }
  @page { size: A4; margin: 10mm; }
</style>`;

const PDF_EXPORT_STYLES = `
<style>
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .inv-page {
    max-width: none !important;
    margin: 0 !important;
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
  }
  @page { size: A4; margin: 8mm; }
  .inv-page.inv-pdf .inv-body { padding: 16px 20px 14px !important; }
  .inv-page.inv-pdf .inv-parties { margin: 14px 0 12px !important; }
  .inv-page.inv-pdf .inv-table th { padding: 7px 8px !important; }
  .inv-page.inv-pdf .inv-table td { padding: 8px !important; }
  .inv-page.inv-pdf .inv-bottom { margin-top: 12px !important; gap: 16px !important; }
  .inv-page.inv-pdf .inv-signature { margin-top: 20px !important; }
  .inv-page.inv-pdf .inv-signature-line { margin-top: 28px !important; }
  .inv-page.inv-pdf .inv-terms-block { margin-top: 10px !important; }
  .inv-page.inv-pdf .inv-terms { margin-bottom: 4px !important; line-height: 1.45 !important; }
  .inv-page.inv-pdf .inv-generated { margin-top: 10px !important; padding-top: 10px !important; page-break-inside: avoid !important; }
</style>`;

const PREVIEW_TOOLBAR = `
<div class="no-print" style="position:sticky;top:0;z-index:10;background:${BRAND_INK};color:#fff;padding:12px 20px;display:flex;gap:12px;align-items:center;justify-content:space-between;">
  <strong>SpaceHaat Invoice Preview</strong>
  <button type="button" onclick="window.print()" style="background:${BRAND};color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:700;">Print</button>
</div>`;

export function renderInvoiceHtml(invoice, options = {}) {
    const { forPrint = false, showToolbar = false, forPdf = false } = options;
    const seller = invoice.billing_snapshot?.seller || {};
    const buyer = invoice.billing_snapshot?.buyer || {};
    const shipTo = invoice.billing_snapshot?.ship_to;
    const lines = invoice.line_items || [];
    const title = getInvoiceTitle(invoice);
    const taxLabels = getInvoiceTaxLabels(invoice);
    const isInterState = invoice.tax_mode === 'inter_state';
    const money = forPdf ? formatMoneyPdf : formatMoney;

    const lineRows = lines.map((l, idx) => {
        const taxRate = Number(l.tax_rate) || 0;
        const lineTax = isInterState
            ? Number(l.igst) || 0
            : (Number(l.cgst) || 0) + (Number(l.sgst) || 0);
        return `
        <tr>
          <td class="center">${idx + 1}</td>
          <td>${formatMultiline(l.description)}${l.details ? `<br><span style="font-size:11px;color:#666">${formatMultiline(l.details)}</span>` : ''}</td>
          <td class="center">${esc(l.hsn_sac || '997212')}</td>
          <td class="center">${esc(l.quantity ?? 1)}</td>
          <td class="num">${money(l.unit_price)}</td>
          <td class="center">${taxRate ? `${taxRate}%` : '—'}</td>
          <td class="num">${money(lineTax)}</td>
          <td class="num">${money(lineBaseAmount(l))}</td>
        </tr>`;
    }).join('');

    const taxSummaryRow = isInterState
        ? `<div class="inv-total-row"><span>${esc(taxLabels.igst)}</span><strong>${money(invoice.igst)}</strong></div>`
        : `<div class="inv-total-row"><span>${esc(taxLabels.cgst)}</span><strong>${money(invoice.cgst)}</strong></div>
           <div class="inv-total-row"><span>${esc(taxLabels.sgst)}</span><strong>${money(invoice.sgst)}</strong></div>`;

    const bank = seller.bank_details || {};
    const bankAddressLine = formatBankAddressLine(bank.address);
    const { primaryName: buyerPrimaryName } = getBillToDisplayNames(buyer);
    const buyerDetailHtml = formatDetailLinesHtml(formatBillToDetailLines(buyer));

    const shipToName = hasShipToSection(shipTo) ? getShipToDisplayName(shipTo) : buyerPrimaryName;
    const shipToHtml = hasShipToSection(shipTo)
        ? formatDetailLinesHtml(formatShipToDetailLines(shipTo))
        : buyerDetailHtml;

    const logoSrc = getSpacehaatLogoBase64();
    const logoHtml = logoSrc
        ? `<img class="inv-logo" src="${logoSrc}" alt="SpaceHaat" />`
        : '<h1 class="inv-brand-fallback">spacehaat</h1>';

    const sellerName = seller.legal_name || seller.trade_name || 'Unitechcyber Technologies Pvt Ltd';

    const pdfPageClass = forPdf ? ' inv-pdf' : '';

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Invoice ${esc(invoice.invoice_number || 'Draft')}</title>
${BASE_STYLES}
${forPdf ? PDF_EXPORT_STYLES : ''}
</head>
<body style="padding:${forPdf || showToolbar ? '0' : '24px'};">
  ${showToolbar ? PREVIEW_TOOLBAR : ''}
  <div class="inv-page${pdfPageClass}">
    <div class="inv-sheet-accent"></div>
    <div class="inv-body">
      <div class="inv-top">
        <div>
          ${logoHtml}
          <div class="inv-seller-lines">
            <strong>${esc(sellerName)}</strong>
            ${formatAddress(seller.address) ? `${formatAddress(seller.address)}<br>` : ''}
            ${seller.gstin ? `GSTIN ${esc(seller.gstin)}<br>` : ''}
            ${seller.phone ? `${esc(seller.phone)}<br>` : ''}
            ${seller.email ? `${esc(seller.email)}<br>` : ''}
            ${seller.website ? `${esc(seller.website)}` : ''}
          </div>
        </div>
        <div class="inv-doc-side">
          <h1 class="inv-doc-title">${title}</h1>
          <div class="inv-meta-row"><span># :</span><b>${esc(invoice.invoice_number || 'Draft')}</b></div>
          <div class="inv-meta-row"><span>Invoice Date :</span><b>${formatDate(invoice.issue_date)}</b></div>
          <div class="inv-meta-row"><span>Terms :</span><b>Custom</b></div>
          <div class="inv-meta-row"><span>Due Date :</span><b>${formatDate(invoice.due_date)}</b></div>
          <div class="inv-meta-row"><span>Place Of Supply :</span><b>${esc(formatPosLabel(buyer))}</b></div>
        </div>
      </div>

      <div class="inv-parties">
        <div class="inv-party-col">
          <p class="inv-party-label">Bill To</p>
          <p class="inv-party-name">${esc(buyerPrimaryName)}</p>
          <div class="inv-party-lines">${buyerDetailHtml}</div>
        </div>
        <div class="inv-party-col">
          <p class="inv-party-label">Ship To</p>
          <p class="inv-party-name">${esc(shipToName)}</p>
          <div class="inv-party-lines">${shipToHtml}</div>
        </div>
      </div>

      <div class="inv-table-wrap">
        <table class="inv-table">
          <thead>
            <tr>
              <th class="center" style="width:4%">#</th>
              <th style="width:28%">Item &amp; Description</th>
              <th class="center" style="width:10%">HSN/SAC</th>
              <th class="center" style="width:6%">Qty</th>
              <th class="num" style="width:12%">Rate</th>
              <th class="center" style="width:8%">${isInterState ? 'IGST' : 'Tax'}<br><span style="font-weight:400;font-size:10px">%</span></th>
              <th class="num" style="width:10%">Amt</th>
              <th class="num" style="width:12%">Amount</th>
            </tr>
          </thead>
          <tbody>${lineRows}</tbody>
        </table>
      </div>

      <div class="inv-bottom">
        <div>
          ${bank.account_number ? `
          <div class="inv-bank-block">
            <p class="inv-bank-title">Company Bank Details:-</p>
            ${bank.account_number ? `<div>Bank Account No: ${esc(bank.account_number)}</div>` : ''}
            ${bank.ifsc ? `<div>IFSC: ${esc(bank.ifsc)}</div>` : ''}
            ${seller.gstin ? `<div>GSTIN: ${esc(seller.gstin)}</div>` : ''}
            ${bank.bank_name ? `<div>Bank Name: ${esc(bank.bank_name)}</div>` : ''}
            ${bankAddressLine ? `<div>Bank Branch Address: ${esc(bankAddressLine)}</div>` : ''}
          </div>` : ''}
          ${invoice.notes ? `<div class="inv-notes"><div class="inv-notes-title">Notes</div>${formatMultiline(invoice.notes)}</div>` : ''}
        </div>
        <div>
          <div class="inv-totals">
            <div class="inv-total-row"><span>Sub Total</span><strong>${money(invoiceTaxableSubtotal(invoice))}</strong></div>
            ${taxSummaryRow}
            <div class="inv-total-row grand"><span>Total</span><strong>${money(invoice.total)}</strong></div>
            <div class="inv-total-row"><span>Balance Due</span><strong>${money(invoice.balance_due ?? invoice.total)}</strong></div>
          </div>
        </div>
      </div>

      <div class="inv-words">Total In Words<br>${esc(amountInWords(invoice.total))}</div>

      ${formatTermsBlock(invoice.terms)}

      <div class="inv-signature">
        <div class="inv-signature-line">Authorized Signature</div>
      </div>

      <p class="inv-generated">This is a computer-generated invoice and does not require a physical signature.</p>
    </div>
  </div>
</body></html>`;
}

export function renderInvoicePrintHtml(invoice) {
    return renderInvoiceHtml(invoice, { forPrint: true, showToolbar: true });
}

export function renderInvoicePdfHtml(invoice) {
    return renderInvoiceHtml(invoice, { forPrint: true, forPdf: true, showToolbar: false });
}
