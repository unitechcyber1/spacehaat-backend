const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const normalized = email.trim().toLowerCase();
    if (!normalized || normalized.length > 254) return false;
    return EMAIL_RE.test(normalized);
}

function flattenEmailInput(input) {
    if (Array.isArray(input)) return input.map((item) => String(item || '').trim()).filter(Boolean);
    if (typeof input === 'string') {
        return input.split(/[,;]/).map((item) => item.trim()).filter(Boolean);
    }
    return [];
}

/** Returns invalid addresses from raw user input (does not silently drop). */
export function findInvalidEmails(input) {
    const invalid = [];
    const seen = new Set();
    for (const item of flattenEmailInput(input)) {
        const key = item.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        if (!isValidEmail(item)) invalid.push(item);
    }
    return invalid;
}

/** Normalize string | string[] into unique valid emails (lowercase). */
export function normalizeEmailList(input) {
    const raw = Array.isArray(input)
        ? input
        : (typeof input === 'string' ? input.split(/[,;]/) : []);

    const seen = new Set();
    const out = [];
    for (const item of raw) {
        const email = String(item || '').trim().toLowerCase();
        if (!email || !isValidEmail(email) || seen.has(email)) continue;
        seen.add(email);
        out.push(email);
    }
    return out;
}

export function dedupeAcrossRecipientLists({ to = [], cc = [], bcc = [] }) {
    const toSet = new Set(to.map((e) => e.toLowerCase()));
    const ccFiltered = cc.filter((e) => !toSet.has(e.toLowerCase()));
    const ccSet = new Set(ccFiltered.map((e) => e.toLowerCase()));
    const bccFiltered = bcc.filter((e) => !toSet.has(e.toLowerCase()) && !ccSet.has(e.toLowerCase()));
    return { to, cc: ccFiltered, bcc: bccFiltered };
}

export function formatInvoiceDueDate(dueDate) {
    if (!dueDate) return '—';
    return new Date(dueDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

export function formatInvoiceTotal(total) {
    return Number(total || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function buildDefaultInvoiceEmailSubject(invoice) {
    const num = invoice?.invoice_number || 'Draft';
    const total = formatInvoiceTotal(invoice?.total);
    const due = formatInvoiceDueDate(invoice?.due_date);
    return `Invoice ${num} from SpaceHaat — Rs. ${total} due ${due}`;
}

export function buildInvoiceEmailHtmlVariables({
    invoice,
    buyer = {},
    message = '',
    paymentLink = '',
}) {
    const customMessage = String(message || '').trim();
    const customMessageBlock = customMessage
        ? `<p style="margin:16px 0;line-height:1.6;color:#374151;">${escapeHtml(customMessage).replace(/\n/g, '<br>')}</p>`
        : '';

    const paymentLinkBlock = paymentLink
        ? `<p style="text-align:center;margin:24px 0;"><a href="${escapeHtml(paymentLink)}" style="background:#1a56db;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">Pay Now</a></p>`
        : '';

    return {
        clientName: buyer.billing_name || buyer.name || 'Customer',
        invoiceNumber: invoice.invoice_number || '—',
        total: formatInvoiceTotal(invoice.total),
        dueDate: formatInvoiceDueDate(invoice.due_date),
        paymentLink: paymentLink || '',
        customMessageBlock,
        paymentLinkBlock,
    };
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function validateInvoiceSendPayload({ to, cc, bcc, reply_to }) {
    const invalid = [
        ...findInvalidEmails(to),
        ...findInvalidEmails(cc),
        ...findInvalidEmails(bcc),
    ];
    if (reply_to && String(reply_to).trim() && !isValidEmail(reply_to)) {
        invalid.push(String(reply_to).trim());
    }

    if (invalid.length) {
        return {
            ok: false,
            message: `Invalid email address(es): ${[...new Set(invalid)].join(', ')}`,
        };
    }

    const toList = normalizeEmailList(to);
    if (!toList.length) {
        return { ok: false, message: 'At least one valid recipient email is required in "to"' };
    }
    const ccList = normalizeEmailList(cc);
    const bccList = normalizeEmailList(bcc);
    const deduped = dedupeAcrossRecipientLists({ to: toList, cc: ccList, bcc: bccList });

    let replyTo = null;
    if (reply_to && String(reply_to).trim()) {
        replyTo = String(reply_to).trim().toLowerCase();
    }

    return {
        ok: true,
        to: deduped.to,
        cc: deduped.cc,
        bcc: deduped.bcc,
        reply_to: replyTo,
    };
}
