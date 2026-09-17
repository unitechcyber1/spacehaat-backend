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

    const puppeteer = await import('puppeteer');
    browserPromise = puppeteer.default.launch({
        headless: 'shell',
        timeout: 60000,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
    });
    return browserPromise;
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
