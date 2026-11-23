/**
 * Ask the website to rebuild pages right after the CMS saves, so its page cache never shows an old
 * copy. `paths` are CMS slugs (`coworking-gurgaon`, `home`) or page paths (`/blog/my-post`).
 *
 * Needs `WEBSITE_CACHE_REFRESH_URL` (e.g. https://spacewallah.com/api/cache-refresh) and
 * `PAGE_REFRESH_KEY` (the same secret the website and nginx have). Without them it does nothing.
 * Never waits for the website and never throws: a save must not fail because a refresh did.
 */
export function refreshWebsitePages(paths) {
    const url = process.env.WEBSITE_CACHE_REFRESH_URL?.trim();
    const key = process.env.PAGE_REFRESH_KEY?.trim();
    const list = (Array.isArray(paths) ? paths : [paths])
        .map((p) => (typeof p === 'string' ? p.trim() : ''))
        .filter(Boolean);
    if (!url || !key || !list.length || typeof fetch !== 'function') return;

    fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-refresh-key': key },
        body: JSON.stringify({ paths: list }),
        signal: AbortSignal.timeout(120000),
    }).catch((error) => {
        console.warn('[website-cache-refresh] failed for', list.join(', '), error?.message || error);
    });
}
