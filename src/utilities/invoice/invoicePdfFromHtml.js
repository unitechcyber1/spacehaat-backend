import fs from 'fs';

import { renderInvoicePdfHtml } from './invoiceHtml.js';

let browserPromise = null;

async function getBrowser() {
    if (browserPromise) {
        try {
            const browser = await browserPromise;
            if (browser.isConnected()) return browser;
        } catch {
            browserPromise = null;
        }
    }

    browserPromise = launchBrowser();
    return browserPromise;
}

const LAUNCH_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'];

// Used when the Chrome that puppeteer downloads is missing (e.g. a reinstall pulled a newer puppeteer
// without its browser). CHROME_PATH lets the server point at any installed Chrome/Chromium.
const SYSTEM_CHROME_PATHS = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

async function launchBrowser() {
    const { default: puppeteer } = await import('puppeteer');
    try {
        return await puppeteer.launch({ headless: 'shell', timeout: 60000, args: LAUNCH_ARGS });
    } catch (err) {
        const executablePath = SYSTEM_CHROME_PATHS.find((p) => fs.existsSync(p));
        if (!executablePath) throw err;
        console.warn(`[invoice] bundled Chrome failed (${err?.message || err}); using ${executablePath}`);
        return puppeteer.launch({ headless: true, executablePath, timeout: 60000, args: LAUNCH_ARGS });
    }
}

function resetBrowser() {
    browserPromise = null;
}

/**
 * Render invoice PDF from the same HTML/CSS as the admin preview (Chromium print).
 * @param {object} invoice
 * @returns {Promise<Buffer>}
 */
export async function generateInvoicePdfFromHtml(invoice) {
    const html = renderInvoicePdfHtml(invoice);
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
        await page.evaluate(() => document.fonts?.ready);

        const pdfBytes = await page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
        });

        return Buffer.from(pdfBytes);
    } catch (err) {
        resetBrowser();
        throw err;
    } finally {
        await page.close().catch(() => {});
    }
}
