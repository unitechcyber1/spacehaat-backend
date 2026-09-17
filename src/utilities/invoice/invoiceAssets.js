import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SPACEHAAT_LOGO_PATH = path.join(__dirname, '../../assets/spacehaat-logo.png');

let cachedLogoBase64 = null;

export function spacehaatLogoExists() {
    return fs.existsSync(SPACEHAAT_LOGO_PATH);
}

export function getSpacehaatLogoBase64() {
    if (cachedLogoBase64) return cachedLogoBase64;
    if (!spacehaatLogoExists()) return null;
    const buf = fs.readFileSync(SPACEHAAT_LOGO_PATH);
    cachedLogoBase64 = `data:image/png;base64,${buf.toString('base64')}`;
    return cachedLogoBase64;
}

/** @deprecated Use getSpacehaatLogoBase64 */
export function getCofyndLogoBase64() {
    return getSpacehaatLogoBase64();
}
