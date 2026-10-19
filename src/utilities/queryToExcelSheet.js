import { google } from "googleapis";
import { JWT } from "google-auth-library";
import { createGoogleSheetsUnavailableClient, loadGoogleServiceAccountJson } from "./loadGoogleCredentials.js";

const keys = loadGoogleServiceAccountJson({
    prefix: "GOOGLE_WEB_QUERY_CREDENTIALS",
    defaultFilename: "website-queries-form-cf8165b3b02a.json",
});

export const web_query_sheet = keys?.client_email && keys?.private_key
    ? google.sheets({
        version: "v4",
        auth: new JWT({
            email: keys.client_email,
            key: keys.private_key,
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        }),
    })
    : createGoogleSheetsUnavailableClient("GOOGLE_WEB_QUERY_CREDENTIALS");