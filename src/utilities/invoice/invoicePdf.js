import PDFDocument from 'pdfkit';
import { generateInvoicePdfFromHtml } from './invoicePdfFromHtml.js';
import {
    amountInWords,
    formatBankAddressLine,
    formatBillToDetailLines,
    formatDate,
    formatMoneyPdf,
    getBillToDisplayNames,
    getInvoiceTaxLabels,
    getInvoiceTitle,
    hasShipToSection,
    invoiceAddressLines,
    invoiceTaxableSubtotal,
    lineBaseAmount,
    normalizeShipToParty,
} from './invoiceFormat.js';
import { SPACEHAAT_LOGO_PATH, spacehaatLogoExists } from './invoiceAssets.js';

const BRAND = '#4CAF50';
const BRAND_INK = '#2E7D32';
const INK = '#111827';
const BODY = '#374151';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const PANEL_BG = '#F9FAFB';
const TABLE_HEAD = '#E8F5E9';

function addressLines(addr) {
    return invoiceAddressLines(addr);
}

function buildSellerLines(seller) {
    return [
        seller.trade_name || seller.legal_name || 'Unitechcyber Technologies Pvt Ltd',
        ...addressLines(seller.address),
        seller.gstin ? `GSTIN: ${seller.gstin}` : null,
        seller.pan ? `PAN: ${seller.pan}` : null,
        seller.cin ? `CIN: ${seller.cin}` : null,
        seller.phone ? `Phone: ${seller.phone}` : null,
        seller.website ? `Website: ${seller.website}` : null,
    ].filter(Boolean);
}

function buildBuyerLines(buyer) {
    const { primaryName } = getBillToDisplayNames(buyer);
    const detailLines = formatBillToDetailLines(buyer).map((row) => {
        if (!row.label) return row.value;
        return `${row.label}: ${row.value}`;
    });
    return [primaryName, ...detailLines].filter(Boolean);
}

function buildShipToLines(shipTo) {
    return buildBuyerLines(normalizeShipToParty(shipTo));
}

const PANEL_PAD_X = 16;
const PANEL_PAD_Y = 14;
const PANEL_RADIUS = 8;
const PANEL_GAP = 16;
const SHIP_STACK_GAP = 12;
// PDFKit fallback only (HTML->PDF path is the primary generator).
// Keep this layout conservative and compact so it doesn't break pages.
const PANEL_TITLE_SIZE = 8.5;
const PANEL_NAME_SIZE = 11;
const PANEL_BODY_SIZE = 10;
const PANEL_TITLE_BLOCK = 15;
const PANEL_NAME_GAP = 7;
const PANEL_LINE_GAP = 4;

function getPageMargins(hasShipTo) {
    if (!hasShipTo) {
        return { top: 28, bottom: 28, left: 32, right: 32 };
    }
    return { top: 24, bottom: 22, left: 28, right: 28 };
}

/** Vertical rhythm — tightened only when Ship To is present to help fit one page. */
function getSpacing(hasShipTo) {
    if (!hasShipTo) {
        return {
            panelPadY: PANEL_PAD_Y,
            shipStackGap: SHIP_STACK_GAP,
            panelLineGap: PANEL_LINE_GAP,
            afterTitle: 12,
            afterAccent: 14,
            afterPanels: 16,
            placeOfSupplyTrail: 14,
            metaRowGap: 14,
            headerMetaGap: 8,
            footerTopGap: 14,
            footerEnsurePad: 30,
            footerBlockExtra: 10,
            footerAfter: 8,
            wordsBoxPad: 16,
            wordsAfter: 8,
            minRowH: 22,
            rowPadY: 6,
            grandRowH: 32,
            termsHeadingGap: 4,
            termsClauseGap: 4,
            footerReserve: 14,
        };
    }
    return {
        panelPadY: 10,
        shipStackGap: 8,
        panelLineGap: 3,
        afterTitle: 8,
        afterAccent: 10,
        afterPanels: 10,
        placeOfSupplyTrail: 8,
        metaRowGap: 8,
        headerMetaGap: 5,
        footerTopGap: 8,
        footerEnsurePad: 16,
        footerBlockExtra: 6,
        footerAfter: 6,
        wordsBoxPad: 12,
        wordsAfter: 6,
        minRowH: 20,
        rowPadY: 5,
        grandRowH: 28,
        termsHeadingGap: 2,
        termsClauseGap: 2,
        footerReserve: 10,
    };
}

function contentBottom(doc, footerReserve = 20) {
    return doc.page.height - doc.page.margins.bottom - footerReserve;
}

function ensureSpace(doc, y, needed, footerReserve = 20) {
    const bottom = contentBottom(doc, footerReserve);
    if (y + needed <= bottom) return y;
    doc.addPage();
    return doc.page.margins.top;
}

function measureLines(doc, lines, width, font = 'Helvetica', size = 8, lineGap = 2) {
    doc.font(font).fontSize(size);
    let height = 0;
    for (const line of lines) {
        if (!line) continue;
        height += doc.heightOfString(String(line), { width, lineGap }) + lineGap;
    }
    return height;
}

function measurePartyPanel(doc, width, lines, spacing, boldFirst = true) {
    const innerW = width - PANEL_PAD_X * 2;
    const contentLines = lines.filter(Boolean);
    let h = spacing.panelPadY + PANEL_TITLE_BLOCK + PANEL_NAME_GAP;

    if (boldFirst && contentLines[0]) {
        doc.font('Helvetica-Bold').fontSize(PANEL_NAME_SIZE);
        h += doc.heightOfString(String(contentLines[0]), { width: innerW, lineGap: 0 }) + PANEL_NAME_GAP;
    }

    const startIdx = boldFirst ? 1 : 0;
    h += measureLines(
        doc,
        contentLines.slice(startIdx),
        innerW,
        'Helvetica',
        PANEL_BODY_SIZE,
        spacing.panelLineGap
    );

    return h + spacing.panelPadY;
}

function drawPartyPanel(doc, { x, y, width, height, title, lines, spacing, boldFirst = true }) {
    const innerW = width - PANEL_PAD_X * 2;
    const contentLines = lines.filter(Boolean);

    doc.save();
    doc.roundedRect(x, y, width, height, PANEL_RADIUS).fillAndStroke(PANEL_BG, BORDER);
    doc.restore();

    doc.font('Helvetica-Bold').fontSize(PANEL_TITLE_SIZE).fillColor(MUTED)
        .text(title.toUpperCase(), x + PANEL_PAD_X, y + spacing.panelPadY, {
            width: innerW,
            characterSpacing: 0.8,
        });

    let cursorY = y + spacing.panelPadY + PANEL_TITLE_BLOCK;

    if (boldFirst && contentLines[0]) {
        doc.font('Helvetica-Bold').fontSize(PANEL_NAME_SIZE).fillColor(INK)
            .text(String(contentLines[0]), x + PANEL_PAD_X, cursorY, { width: innerW, lineGap: 0 });
        cursorY = doc.y + PANEL_NAME_GAP;
    }

    const startIdx = boldFirst ? 1 : 0;
    for (let i = startIdx; i < contentLines.length; i += 1) {
        doc.font('Helvetica').fontSize(PANEL_BODY_SIZE).fillColor(BODY)
            .text(String(contentLines[i]), x + PANEL_PAD_X, cursorY, {
                width: innerW,
                lineGap: spacing.panelLineGap,
            });
        cursorY = doc.y + spacing.panelLineGap;
    }
}

function drawPlaceOfSupply(doc, x, y, pageWidth, buyer, trailGap = 14) {
    const placeOfSupply = buyer.place_of_supply_state || buyer.billing_address?.state || '—';
    doc.font('Helvetica').fontSize(9.5).fillColor(MUTED)
        .text('Place of supply: ', x, y, { continued: true, width: pageWidth });
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(INK).text(placeOfSupply);
    return doc.y + trailGap;
}

function drawMetaLeft(doc, x, y, width, rows, rowGap = 10) {
    let rowY = y;
    const labelW = 92;

    for (const [label, value] of rows) {
        doc.font('Helvetica').fontSize(9).fillColor(MUTED)
            .text(label, x, rowY, { width: labelW });
        doc.font('Helvetica-Bold').fontSize(9).fillColor(INK)
            .text(String(value || '—'), x + labelW + 8, rowY, { width: width - labelW - 8 });
        rowY += rowGap;
    }

    return rowY;
}

/**
 * @param {object} invoice — lean or mongoose invoice doc
 * @returns {Promise<Buffer>}
 */
export async function generateInvoicePdfBuffer(invoice) {
    try {
        return await generateInvoicePdfFromHtml(invoice);
    } catch (err) {
        console.warn('[invoice] HTML PDF generation failed, falling back to PDFKit:', err?.message || err);
        return generateInvoicePdfKitBuffer(invoice);
    }
}

function generateInvoicePdfKitBuffer(invoice) {
    return new Promise((resolve, reject) => {
        try {
            const seller = invoice.billing_snapshot?.seller || {};
            const buyer = invoice.billing_snapshot?.buyer || {};
            const shipTo = invoice.billing_snapshot?.ship_to;
            const lines = invoice.line_items || [];
            const hasShipTo = hasShipToSection(shipTo);
            const spacing = getSpacing(hasShipTo);

            const doc = new PDFDocument({
                size: 'A4',
                margins: getPageMargins(hasShipTo),
                autoFirstPage: true,
            });
            const chunks = [];
            doc.on('data', (c) => chunks.push(c));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const title = getInvoiceTitle(invoice);
            const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
            const leftX = doc.page.margins.left;
            let y = doc.page.margins.top;

            // ── Invoice meta (left) + logo (right) ──
            const logoW = 130;
            const logoH = 36;
            if (spacehaatLogoExists()) {
                doc.image(SPACEHAAT_LOGO_PATH, leftX + pageWidth - logoW, y, { width: logoW, height: logoH, fit: [logoW, logoH] });
            } else {
                doc.font('Helvetica-Bold').fontSize(18).fillColor(BRAND)
                    .text('SpaceHaat', leftX + pageWidth - logoW, y, { width: logoW, align: 'right' });
            }

            const metaRows = [
                ['Invoice No.', invoice.invoice_number || '—'],
                ...(invoice.proforma_invoice_number && invoice.invoice_type === 'client'
                    ? [['Proforma ref', invoice.proforma_invoice_number]]
                    : []),
                ['Invoice date', formatDate(invoice.issue_date)],
                ['Due date', formatDate(invoice.due_date)],
            ];
            const metaBottom = drawMetaLeft(doc, leftX, y, pageWidth * 0.52, metaRows, spacing.metaRowGap);

            y = Math.max(y + logoH + spacing.headerMetaGap, metaBottom + spacing.headerMetaGap);

            doc.font('Helvetica-Bold').fontSize(15).fillColor(INK)
                .text(title, leftX, y, { width: pageWidth, align: 'center', lineGap: 0 });
            y = doc.y + spacing.afterTitle;

            doc.save();
            doc.rect(leftX, y, pageWidth, 3).fill(BRAND);
            doc.restore();
            y += spacing.afterAccent;

            // ── Bill From + Bill To (equal-height side-by-side panels) ──
            const panelW = (pageWidth - PANEL_GAP) / 2;
            const rightPanelX = leftX + panelW + PANEL_GAP;

            const sellerLines = buildSellerLines(seller);
            const buyerLines = buildBuyerLines(buyer);
            const shipToLines = hasShipTo ? buildShipToLines(shipTo) : [];

            const billFromH = measurePartyPanel(doc, panelW, sellerLines, spacing);
            const billToH = measurePartyPanel(doc, panelW, buyerLines, spacing);
            const shipToH = hasShipTo ? measurePartyPanel(doc, panelW, shipToLines, spacing) : 0;
            const rightStackH = billToH + (hasShipTo ? spacing.shipStackGap + shipToH : 0);
            const panelHeight = Math.max(billFromH, rightStackH);

            const panelStartY = y;
            drawPartyPanel(doc, {
                x: leftX,
                y: panelStartY,
                width: panelW,
                height: panelHeight,
                title: 'Bill From',
                lines: sellerLines,
                spacing,
            });
            drawPartyPanel(doc, {
                x: rightPanelX,
                y: panelStartY,
                width: panelW,
                height: hasShipTo ? billToH : panelHeight,
                title: 'Bill To',
                lines: buyerLines,
                spacing,
            });
            if (hasShipTo) {
                drawPartyPanel(doc, {
                    x: rightPanelX,
                    y: panelStartY + billToH + spacing.shipStackGap,
                    width: panelW,
                    height: shipToH,
                    title: 'Ship To',
                    lines: shipToLines,
                    spacing,
                });
            }

            y = panelStartY + panelHeight + spacing.afterPanels;

            y = ensureSpace(doc, y, 20, spacing.footerReserve);
            y = drawPlaceOfSupply(doc, leftX, y, pageWidth, buyer, spacing.placeOfSupplyTrail);

            // ── Line items table ──
            const tableX = leftX;
            const colDefs = [
                { label: 'Description', x: 0, w: 220, align: 'left' },
                { label: 'HSN/SAC', x: 220, w: 56, align: 'center' },
                { label: 'Qty', x: 276, w: 36, align: 'center' },
                { label: 'Rate', x: 312, w: 80, align: 'right' },
                { label: 'Amount', x: 392, w: pageWidth - 392, align: 'right' },
            ];

            const headerH = 22;
            const tableStartY = y;
            y = ensureSpace(doc, y, headerH + 24, spacing.footerReserve);

            doc.save();
            doc.rect(tableX, y, pageWidth, headerH).fill(TABLE_HEAD);
            doc.restore();
            doc.moveTo(tableX, y + headerH).lineTo(tableX + pageWidth, y + headerH)
                .strokeColor(BRAND).lineWidth(1).stroke();

            doc.font('Helvetica-Bold').fontSize(8.5).fillColor(BODY);
            for (const col of colDefs) {
                doc.text(col.label, tableX + col.x + 8, y + 7, {
                    width: col.w - 12,
                    align: col.align,
                });
            }

            let rowY = y + headerH;
            doc.font('Helvetica').fontSize(9).fillColor(INK);

            for (const line of lines) {
                const descText = [line.description || '—', line.details].filter(Boolean).join('\n');
                const descH = doc.heightOfString(descText, { width: colDefs[0].w - 16, lineGap: 2 });
                const rowH = Math.max(spacing.minRowH, descH + spacing.rowPadY * 2);

                rowY = ensureSpace(doc, rowY, rowH, spacing.footerReserve);

                doc.moveTo(tableX, rowY).lineTo(tableX + pageWidth, rowY)
                    .strokeColor(BORDER).lineWidth(0.5).stroke();

                const cellY = rowY + spacing.rowPadY;
                doc.font('Helvetica-Bold').fontSize(9).fillColor(INK);
                doc.text(line.description || '—', tableX + colDefs[0].x + 8, cellY, { width: colDefs[0].w - 16 });
                if (line.details) {
                    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
                    doc.text(line.details, tableX + colDefs[0].x + 8, doc.y + 2, { width: colDefs[0].w - 16, lineGap: 1 });
                }
                doc.font('Helvetica').fontSize(9).fillColor(INK);
                doc.text(line.hsn_sac || '—', tableX + colDefs[1].x + 2, cellY, { width: colDefs[1].w - 4, align: 'center' });
                doc.text(String(line.quantity ?? ''), tableX + colDefs[2].x + 2, cellY, { width: colDefs[2].w - 4, align: 'center' });
                doc.text(formatMoneyPdf(line.unit_price), tableX + colDefs[3].x + 2, cellY, { width: colDefs[3].w - 4, align: 'right' });
                doc.text(formatMoneyPdf(lineBaseAmount(line)), tableX + colDefs[4].x + 2, cellY, { width: colDefs[4].w - 4, align: 'right' });

                rowY += rowH;
            }

            doc.save();
            doc.roundedRect(tableX, tableStartY, pageWidth, rowY - tableStartY, 6)
                .strokeColor(BORDER).lineWidth(0.75).stroke();
            doc.restore();

            // ── Footer: bank + totals (side by side, fixed height) ──
            const totalsW = 220;
            const totalsX = leftX + pageWidth - totalsW;
            const taxRowCount = invoice.tax_mode === 'inter_state' ? 2 : 3;
            const grandRowH = spacing.grandRowH;
            const grandPadX = 14;
            const grandPadY = 9;
            const totalsH = 12 + taxRowCount * 15 + 12 + grandRowH + 10;

            const bank = seller.bank_details || {};
            const bankAddressOneLine = formatBankAddressLine(bank.address);
            const bankLines = bank.account_number ? [
                bank.bank_name ? `Bank: ${bank.bank_name}` : null,
                bankAddressOneLine ? `Bank address: ${bankAddressOneLine}` : null,
                bank.account_name ? `Account: ${bank.account_name}` : null,
                bank.account_number ? `A/C No: ${bank.account_number}` : null,
                bank.ifsc ? `IFSC: ${bank.ifsc}` : null,
            ].filter(Boolean) : [];

            const bankBlockH = bankLines.length ? 14 + measureLines(doc, bankLines, pageWidth - totalsW - 16, 'Helvetica', 9, 2) : 0;
            const footerBlockH = Math.max(totalsH, bankBlockH) + spacing.footerBlockExtra;

            rowY += spacing.footerTopGap;
            rowY = ensureSpace(doc, rowY, footerBlockH + spacing.footerEnsurePad, spacing.footerReserve);

            const footerTop = rowY;

            if (bankLines.length) {
                doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text('Bank details', leftX, footerTop);
                let bankY = footerTop + 14;
                for (const bl of bankLines) {
                    doc.font('Helvetica').fontSize(9).fillColor(BODY)
                        .text(bl, leftX, bankY, { width: pageWidth - totalsW - 16, lineGap: 2 });
                    bankY = doc.y + 2;
                }
            }

            doc.save();
            doc.roundedRect(totalsX, footerTop, totalsW, totalsH, 8).fillAndStroke('#FFFFFF', BORDER);
            doc.restore();

            let totalY = footerTop + 10;
            const drawTotalRow = (label, value) => {
                doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(label, totalsX + 12, totalY, { width: 80 });
                doc.font('Helvetica-Bold').fontSize(9).fillColor(INK)
                    .text(value, totalsX + 12, totalY, { width: totalsW - 24, align: 'right' });
                totalY += 15;
            };

            const taxLabels = getInvoiceTaxLabels(invoice);
            drawTotalRow('Subtotal', formatMoneyPdf(invoiceTaxableSubtotal(invoice)));
            if (invoice.tax_mode === 'inter_state') {
                drawTotalRow(taxLabels.igst, formatMoneyPdf(invoice.igst));
            } else {
                drawTotalRow(taxLabels.cgst, formatMoneyPdf(invoice.cgst));
                drawTotalRow(taxLabels.sgst, formatMoneyPdf(invoice.sgst));
            }

            doc.moveTo(totalsX + 12, totalY).lineTo(totalsX + totalsW - 12, totalY).strokeColor(BORDER).stroke();
            totalY += 10;

            const grandX = totalsX + 12;
            const grandW = totalsW - 24;
            doc.save();
            doc.roundedRect(grandX, totalY, grandW, grandRowH, 6).fill(BRAND);
            doc.restore();
            doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#FFFFFF');
            const grandTextY = totalY + grandPadY;
            const grandInnerW = grandW - grandPadX * 2;
            doc.text('Total', grandX + grandPadX, grandTextY, { width: 80 });
            doc.text(formatMoneyPdf(invoice.total), grandX + grandPadX, grandTextY, {
                width: grandInnerW,
                align: 'right',
            });

            y = footerTop + footerBlockH + spacing.footerAfter;
            const wordsText = `Amount in words: ${amountInWords(invoice.total)}`;
            doc.font('Helvetica-Bold').fontSize(9);
            const wordsBoxH = doc.heightOfString(wordsText, { width: pageWidth - 24, lineGap: 2 })
                + spacing.wordsBoxPad;
            y = ensureSpace(doc, y, wordsBoxH + spacing.wordsAfter, spacing.footerReserve);
            doc.save();
            doc.roundedRect(leftX, y, pageWidth, wordsBoxH, 6).fillAndStroke(PANEL_BG, BORDER);
            doc.restore();
            doc.font('Helvetica-Bold').fontSize(9).fillColor(INK)
                .text(wordsText, leftX + 12, y + 8, { width: pageWidth - 24, lineGap: 2 });
            y += wordsBoxH + spacing.wordsAfter;

            if (invoice.notes) {
                y = ensureSpace(doc, y, 18, spacing.footerReserve);
                doc.font('Helvetica').fontSize(8.5).fillColor(BODY)
                    .text(`Notes: ${invoice.notes}`, leftX, y, { width: pageWidth, lineGap: 2 });
                y = doc.y + 6;
            }

            if (invoice.terms) {
                y = ensureSpace(doc, y, hasShipTo ? 20 : 28, spacing.footerReserve);
                doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INK)
                    .text('Terms & conditions', leftX, y, { width: pageWidth });
                y = doc.y + spacing.termsHeadingGap;
                const clauses = String(invoice.terms).split('\n').map((t) => t.trim()).filter(Boolean);
                for (const clause of clauses) {
                    y = ensureSpace(doc, y, hasShipTo ? 12 : 14, spacing.footerReserve);
                    doc.font('Helvetica').fontSize(8.5).fillColor(BODY)
                        .text(clause, leftX, y, { width: pageWidth, lineGap: hasShipTo ? 1.5 : 2 });
                    y = doc.y + spacing.termsClauseGap;
                }
            }

            const noteY = Math.min(y + spacing.wordsAfter, contentBottom(doc, spacing.footerReserve));
            doc.font('Helvetica').fontSize(7.5).fillColor('#9CA3AF')
                .text(
                    'This is a computer-generated invoice and does not require a physical signature.',
                    leftX,
                    noteY,
                    { width: pageWidth, align: 'center', lineGap: 0 }
                );

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}
