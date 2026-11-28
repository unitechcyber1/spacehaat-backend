import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Previous SpaceHaat logo is kept at ../../assets/spacehaat-logo.png; point this back at it to restore.
export const INVOICE_LOGO_PATH = path.join(__dirname, '../../assets/spacewallah-invoice-logo.png');

/** Bump when the PDF look changes (logo etc.) so PDFs saved before are made again. */
export const INVOICE_PDF_LAYOUT = 'spacewallah-2026-11';

let cachedLogoBase64 = null;

export function invoiceLogoExists() {
    return fs.existsSync(INVOICE_LOGO_PATH);
}

export function getInvoiceLogoBase64() {
    if (cachedLogoBase64) return cachedLogoBase64;
    if (!invoiceLogoExists()) return null;
    const buf = fs.readFileSync(INVOICE_LOGO_PATH);
    cachedLogoBase64 = `data:image/png;base64,${buf.toString('base64')}`;
    return cachedLogoBase64;
}
