import { Router } from 'express';
const router = Router();
import manageSeo from '../../controllers/admin/ManageSeo.js';

router.get('/seo', manageSeo.getSeos)
    .get('/seo/:seoId', manageSeo.getSeoById)
    .post('/seo', manageSeo.addOrEditSeo)
    .put('/seo/:seoId', manageSeo.addOrEditSeo)
    .delete('/seo/:seoId', manageSeo.deleteSeo)

export default router;
