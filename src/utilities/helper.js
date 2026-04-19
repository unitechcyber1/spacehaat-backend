import bcrypt from 'bcrypt';
import app from '../config/app.js';

/** aes256 requires a non-empty string key; dotenv must define ENCRYPTION_KEY=... */
export function requireEncryptionKey() {
    const k = app.encryptionKey;
    if (k == null || String(k).trim() === '') {
        throw new Error(
            'ENCRYPTION_KEY is missing or empty. In .env use ENCRYPTION_KEY="your-secret" (equals sign, ' +
                'quote the value if it contains #, ?, spaces, etc.).'
        );
    }
    return String(k).trim();
}

// hash password for reg
export const hashPassword = (password) => {
    return new Promise((resolve, reject) => {
        try {
            bcrypt.hash(password, 10, (err, hashed) => {
                if (err) return resolve(null);
                return resolve(hashed)
            })
        } catch (e) {
            console.log(e)
            resolve(null)
        }
    })
}

export const makePlural = (number, str, sufix) => {
    //to do make it work for ies as well
    if (number > 1) {
        return `${number} ${str}${sufix}`
    } else {
        return `${number} ${str}`
    }
}
