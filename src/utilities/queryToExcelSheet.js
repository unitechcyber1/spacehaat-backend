import { google } from "googleapis";
import { JWT } from "google-auth-library";
import { loadGoogleServiceAccountJson } from "./loadGoogleCredentials.js";

const keys = loadGoogleServiceAccountJson({
    prefix: "GOOGLE_WEB_QUERY_CREDENTIALS",
    defaultFilename: "website-queries-form-cf8165b3b02a.json",
});

const client = new JWT({
    email: keys.client_email,
    key: keys.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

 export const web_query_sheet = google.sheets({ version: "v4", auth: client });