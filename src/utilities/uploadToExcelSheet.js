import { google } from "googleapis";
import { JWT } from "google-auth-library";
import keys from "../../listing-module-queries-9d143be3b97d.json" assert { type: "json" };

const client = new JWT({
    email: keys.client_email,
    key: keys.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

export const sheets = google.sheets({ version: "v4", auth: client });


export default function extractSpreadsheetId(link) {
    const matches = link.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (matches && matches[1]) {
        return matches[1];
    }
    throw new Error('Invalid Google Sheet link');
}

export function getFieldNames (obj, parent = '') {
    let fields = [];
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const fullPath = parent ? `${parent}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          fields = fields.concat(getFieldNames(obj[key], fullPath));
        } else {
          fields.push(fullPath);
        }
      }
    }
    return fields;
  };

  