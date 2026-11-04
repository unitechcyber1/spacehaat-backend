import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const INVOICE_LOGO_PATH = path.join(__dirname, '../../assets/spacehaat-logo.png');

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
