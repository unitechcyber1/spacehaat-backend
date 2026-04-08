import express from 'express';
const router = express.Router();
import manageSeo from '../../controllers/admin/ManageSeo.js';

router.get('/seo/:path', manageSeo.getSeoByPath)

export default router;