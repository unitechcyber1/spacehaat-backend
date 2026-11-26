import PDFDocument from 'pdfkit';
import { drawBrandMark, fetchImageBuffer } from '../proposals/proposals.pdf.js';

/**
 * Virtual office proposal for a client: the chosen locations and prices, what's included,
 * our bank details and the sender's signature. One wording for WhatsApp, email and PDF,
 * so every salesperson sends the same thing.
 */

export const VO_INCLUSIONS = [
    ['Legal Compliance Made Easy', 'Use the address for PAN, GST, TAN, Professional Tax, Bank Account and Registered Office setup.'],
    ['Essential Business Documentation Provided', 'Includes Rent / Registered Service Agreement, NOC, Electricity Bill and Property Tax receipt.'],
    ['Meeting Room for Verification', 'A meeting room is available for your GST verification and bank account verification visits.'],
    ['Prestigious Business Address', 'Perfect for building credibility and expanding your business presence.'],
    ['Mail & Courier Handling', 'We receive your mail and couriers and notify you instantly.'],
    ['Address Usability', 'Use it on your visiting cards, website and business communication.'],
];

export const VO_BANK = {
    accountName: 'Spacewallah Enterprises',
    accountNumber: '50200120592160',
    ifsc: 'HDFC0008571',
    branch: 'Sahaswan, Budaun, Uttar Pradesh',
};

const CLOSING = [
    'Once you have selected your preferred location and plan, kindly proceed with the payment and share the transaction screenshot with us.',
    'Upon receiving the payment confirmation, we will initiate the documentation process.',
    'Thank you for choosing SpaceWallah! We look forward to having you on board.',
];

/** Used when the sender has no name on their account. */
const DEFAULT_SENDER = { name: 'Rohan', title: 'Sales Manager', phone: '+91 8796483232' };

const COMPANY_LINES = ['SpaceWallah', 'Website: www.spacewallah.com', 'Email: info@spacewallah.com', 'Co-Working & Virtual Offices Across India'];

function senderOf(sender) {
    if (!sender?.name) return DEFAULT_SENDER;
    const digits = String(sender.phone || '').replace(/\D/g, '');
    const phone = digits.length === 10 ? `+91 ${digits}` : digits.length === 12 && digits.startsWith('91') ? `+91 ${digits.slice(2)}` : sender.phone || '';
    return { name: sender.name, title: sender.title || '', phone };
}

const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const firstName = (s) => String(s || '').trim().split(/\s+/)[0] || '';

/** Lines describing one office's location and price. */
function officeLines(vo, { withAddress, bold }) {
    const b = (s) => (bold ? `*${s}*` : s);
    const place = [vo.locality, vo.city].filter(Boolean).join(', ');
    const lines = [`📍 ${place || vo.city}`];
    if (withAddress && vo.fullAddress) lines.push(`🏢 ${vo.fullAddress}`);
    if (vo.sellingPriceInr) {
        lines.push(`💰 ${b(`${rupees(vo.sellingPriceInr)} / year`)} (${rupees(vo.sellingMonthlyPriceInr || vo.sellingPriceInr / 12)} / month)`);
        if (vo.couponCode && vo.couponPercentage) {
            lines.push(`🏷️ Use code ${b(vo.couponCode)} for ${vo.couponPercentage}% off: ${rupees(vo.priceAfterCouponInr)} / year`);
        }
    } else {
        lines.push('💰 Price on request');
    }
    return lines;
}

/**
 * The proposal as a message. `channel` 'whatsapp' uses *bold*; 'email' is plain text and
 * also gets a subject. `withAddress` adds each office's full address.
 */
export function buildVoProposalText(offices, { clientName = '', channel = 'whatsapp', withAddress = false, sender } = {}) {
    const wa = channel !== 'email';
    const b = (s) => (wa ? `*${s}*` : s);
    const s = senderOf(sender);
    const name = firstName(clientName);
    const many = offices.length > 1;

    const out = [];
    out.push(wa ? `Hi ${name || 'there'}, 👋` : `Dear ${String(clientName || '').trim() || 'Sir / Madam'},`);
    out.push('');
    out.push(
        `Thank you for your interest in a ${b('Virtual Office')} with SpaceWallah. ${many ? `Here are the ${offices.length} options` : 'Here is the option'} we have for you:`,
    );
    offices.forEach((vo, i) => {
        out.push('');
        out.push(b(`${many ? `${i + 1}. ` : ''}${vo.spaceName}`));
        out.push(...officeLines(vo, { withAddress, bold: wa }));
    });
    out.push('');
    out.push(`With our Virtual Office, you gain access to:`);
    for (const [title, text] of VO_INCLUSIONS) out.push(`✅ ${b(title)} – ${text}`);
    out.push('');
    out.push(b('Bank Details for Payment Processing'));
    out.push(`Account Name: ${VO_BANK.accountName}`);
    out.push(`Account Number: ${VO_BANK.accountNumber}`);
    out.push(`IFSC Code: ${VO_BANK.ifsc}`);
    out.push(`Branch: ${VO_BANK.branch}`);
    out.push('');
    for (const line of CLOSING) {
        out.push(line);
        out.push('');
    }
    out.push('Best Regards,');
    out.push(s.name);
    if (s.title) out.push(s.title);
    out.push(COMPANY_LINES[0]);
    if (s.phone) out.push(`M: ${s.phone}`);
    out.push(...COMPANY_LINES.slice(1));

    const cities = [...new Set(offices.map((o) => o.city))].join(', ');
    return {
        text: out.join('\n'),
        subject: `Virtual Office ${many ? 'options' : 'proposal'}${cities ? ` in ${cities}` : ''} – SpaceWallah`,
    };
}

/* ------------------------------------------------------------------ PDF */

const BRAND = '#2E7D32';
const BRAND_SOFT = '#E8F5E9';
const INK = '#1A1A1A';
const MUTED = '#6B6B6B';
const BORDER = '#E5E3DE';
const AMBER = '#9A5B00';

// Helvetica has no ₹ glyph.
const rs = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

function ensureSpace(doc, needed) {
    if (doc.y + needed > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function sectionTitle(doc, text) {
    ensureSpace(doc, 60);
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text(text, doc.page.margins.left);
    doc.moveDown(0.4);
}

/** A4 PDF: cover header, one card per office (with its first photos), inclusions, bank details, signature. */
export async function buildVoProposalPdf(offices, { clientName = '', withAddress = false, sender } = {}) {
    const s = senderOf(sender);
    const photoUrls = offices.map((o) => (o.images || []).slice(0, 2).map((img) => img.url));
    const photos = await Promise.all(photoUrls.map((urls) => Promise.all(urls.map((u) => fetchImageBuffer(u).catch(() => null)))));

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 44, info: { Title: 'Virtual Office Proposal – SpaceWallah', Author: 'SpaceWallah' } });
        const chunks = [];
        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const left = doc.page.margins.left;
        const width = doc.page.width - left - doc.page.margins.right;

        // Header
        drawBrandMark(doc, left, 40);
        doc.font('Helvetica-Bold').fontSize(14).fillColor(INK).text('SpaceWallah', left + 38, 46);
        const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(date, left, 50, { width, align: 'right' });
        doc.moveTo(left, 80).lineTo(left + width, 80).strokeColor(BORDER).lineWidth(1).stroke();

        doc.font('Helvetica-Bold').fontSize(22).fillColor(INK).text('Virtual Office Proposal', left, 98);
        doc.font('Helvetica').fontSize(11).fillColor(MUTED)
            .text(`${clientName ? `Prepared for ${clientName} · ` : ''}${offices.length} location${offices.length === 1 ? '' : 's'}`, left, doc.y + 4);
        doc.moveDown(1);

        // Offices
        offices.forEach((vo, i) => {
            const pics = (photos[i] || []).filter(Boolean);
            const photoH = pics.length ? 150 : 0;
            const addressH = withAddress && vo.fullAddress ? 28 : 0;
            const couponH = vo.couponCode && vo.couponPercentage ? 16 : 0;
            const cardH = 14 + photoH + (photoH ? 12 : 0) + 42 + addressH + couponH + (vo.amenityList?.length ? 16 : 0) + 10;
            ensureSpace(doc, cardH + 10);
            const top = doc.y;
            doc.roundedRect(left, top, width, cardH, 10).strokeColor(BORDER).lineWidth(1).stroke();

            let y = top + 14;
            if (pics.length) {
                const gap = 8;
                const w = pics.length === 1 ? width - 28 : (width - 28 - gap) / 2;
                pics.forEach((buf, k) => {
                    const x = left + 14 + k * (w + gap);
                    try {
                        doc.save();
                        doc.roundedRect(x, y, w, photoH, 8).clip();
                        doc.image(buf, x, y, { cover: [w, photoH], align: 'center', valign: 'center' });
                        doc.restore();
                    } catch {
                        doc.restore();
                    }
                });
                y += photoH + 12;
            }

            doc.font('Helvetica-Bold').fontSize(14).fillColor(INK)
                .text(`${offices.length > 1 ? `${i + 1}. ` : ''}${vo.spaceName}`, left + 14, y, { width: width * 0.6 });
            doc.font('Helvetica').fontSize(10.5).fillColor(MUTED)
                .text([vo.locality, vo.city].filter(Boolean).join(', '), left + 14, y + 20, { width: width * 0.6 });

            // Price, right side
            if (vo.sellingPriceInr) {
                doc.font('Helvetica-Bold').fontSize(16).fillColor(BRAND)
                    .text(rs(vo.sellingPriceInr), left, y, { width: width - 14, align: 'right' });
                doc.font('Helvetica').fontSize(9.5).fillColor(MUTED)
                    .text(`per year · ${rs(vo.sellingMonthlyPriceInr || vo.sellingPriceInr / 12)} / month`, left, y + 21, { width: width - 14, align: 'right' });
            } else {
                doc.font('Helvetica-Bold').fontSize(12).fillColor(MUTED).text('Price on request', left, y + 2, { width: width - 14, align: 'right' });
            }
            y += 42;
            if (addressH) {
                doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(vo.fullAddress, left + 14, y, { width: width - 28, height: 26, ellipsis: true });
                y += addressH;
            }
            if (couponH) {
                doc.font('Helvetica-Bold').fontSize(9.5).fillColor(AMBER)
                    .text(`Use code ${vo.couponCode} for ${vo.couponPercentage}% off: ${rs(vo.priceAfterCouponInr)} / year`, left + 14, y);
                y += couponH;
            }
            if (vo.amenityList?.length) {
                doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(vo.amenityList.join('  ·  '), left + 14, y, { width: width - 28, height: 14, ellipsis: true });
            }
            doc.y = top + cardH + 10;
        });

        // Inclusions
        sectionTitle(doc, 'With our Virtual Office, you gain access to');
        for (const [title, text] of VO_INCLUSIONS) {
            ensureSpace(doc, 34);
            const y = doc.y;
            doc.circle(left + 6, y + 6, 6).fill(BRAND_SOFT);
            doc.moveTo(left + 3, y + 6).lineTo(left + 5.3, y + 8.4).lineTo(left + 9.2, y + 3.8).strokeColor(BRAND).lineWidth(1.4).stroke();
            doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(title, left + 20, y);
            doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(text, left + 20, doc.y + 1, { width: width - 20 });
            doc.moveDown(0.5);
        }

        // Bank details
        sectionTitle(doc, 'Bank Details for Payment Processing');
        ensureSpace(doc, 100);
        const bankTop = doc.y;
        doc.roundedRect(left, bankTop, width, 86, 10).fill(BRAND_SOFT);
        const rows = [
            ['Account Name', VO_BANK.accountName],
            ['Account Number', VO_BANK.accountNumber],
            ['IFSC Code', VO_BANK.ifsc],
            ['Branch', VO_BANK.branch],
        ];
        rows.forEach(([k, v], idx) => {
            const ry = bankTop + 12 + idx * 17;
            doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(k, left + 14, ry, { width: 120 });
            doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(v, left + 140, ry, { width: width - 154 });
        });
        doc.y = bankTop + 98;

        // Closing + signature
        for (const line of CLOSING) {
            ensureSpace(doc, 30);
            doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(line, left, doc.y, { width });
            doc.moveDown(0.6);
        }
        ensureSpace(doc, 110);
        doc.moveDown(0.4);
        doc.font('Helvetica').fontSize(10.5).fillColor(INK).text('Best Regards,', left);
        doc.font('Helvetica-Bold').text(s.name, left);
        doc.font('Helvetica').fillColor(MUTED);
        if (s.title) doc.text(s.title, left);
        doc.text(COMPANY_LINES[0], left);
        if (s.phone) doc.text(`M: ${s.phone}`, left);
        for (const line of COMPANY_LINES.slice(1)) doc.text(line, left);

        doc.end();
    });
}
