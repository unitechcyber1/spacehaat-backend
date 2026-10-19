import express from 'express';
const router = express.Router();
import manageNewSeo from '../../controllers/admin/ManageNewSeo.js';

router.get('/newSeo/:path', manageNewSeo.getSeoByPath)

export default router;