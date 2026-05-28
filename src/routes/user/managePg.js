import express from 'express';

import ManagePgController from '../../controllers/user/ManagePg.js';

const router = express.Router();

router
    .get('/pgs', ManagePgController.getPgs)
    .get('/pgs/:findKey', ManagePgController.getPgByIdOrSlug);

export default router;
