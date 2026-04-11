import fs from 'fs';
import path from 'path';

/**
 * Google service account credentials for Sheets — never commit JSON keys; use env instead.
 *
 * Resolution order:
 * 1. {PREFIX}_BASE64 — base64 of the whole .json file (best for .env / hosting dashboards).
 * 2. {PREFIX}_JSON — full JSON as one string (private_key must use \\n for newlines).
 * 3. {PREFIX}_PATH — filesystem path to the JSON file (local dev; file must stay gitignored).
 * 4. Default filename in project root only if that file exists (local; gitignored).
 */
export function loadGoogleServiceAccountJson({ prefix, defaultFilename }) {
    const jsonVar = `${prefix}_JSON`;
    const base64Var = `${prefix}_BASE64`;
    const pathVar = `${prefix}_PATH`;

    const b64 = process.env[base64Var];
    if (b64 && b64.trim()) {
        try {
            const decoded = Buffer.from(b64.trim(), 'base64').toString('utf8');
            return JSON.parse(decoded);
        } catch (e) {
            throw new Error(`Invalid ${base64Var}: ${e.message}`);
        }
    }

    const jsonRaw = process.env[jsonVar];
    if (jsonRaw && jsonRaw.trim()) {
        try {
            return JSON.parse(jsonRaw);
        } catch (e) {
            throw new Error(`Invalid ${jsonVar}: ${e.message}`);
        }
    }

    const explicit = process.env[pathVar];
    const candidate = explicit
        ? path.isAbsolute(explicit)
            ? explicit
            : path.resolve(process.cwd(), explicit)
        : path.join(process.cwd(), defaultFilename);

    if (fs.existsSync(candidate)) {
        return JSON.parse(fs.readFileSync(candidate, 'utf8'));
    }

    throw new Error(
        `Missing Google credentials (${prefix}). Set ${base64Var} (recommended) or ${jsonVar} or ${pathVar} ` +
            `in your environment. Do not commit service account JSON to git.`
    );
}
