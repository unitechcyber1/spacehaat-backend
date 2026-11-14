import express from 'express';
import { getUrlRedirects } from '../../services/user/url-redirects.js';

const router = express.Router();

/** Old listing URLs → redirect target or "gone", for the website's middleware. Read-only. */
router.get('/url-redirects', async (_req, res, next) => {
    try {
        res.json({ data: await getUrlRedirects() });
    } catch (err) {
        next(err);
    }
});

export default router;
