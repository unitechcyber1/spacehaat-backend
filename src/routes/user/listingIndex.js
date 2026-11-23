import express from 'express';

import ListingIndexController from '../../controllers/user/ListingIndex.js';

const router = express.Router();

/** Slim list of every public listing, for the website's sitemaps and link directories. */
router.get('/listing-index', ListingIndexController.getListingIndex);

export default router;
