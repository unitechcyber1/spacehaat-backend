import { Router } from 'express';
const router = Router();
import manageNewSeo from '../../controllers/admin/ManageNewSeo.js';

router.get('/newSeo', manageNewSeo.getSeos)
    .get('/newSeo/:seoId', manageNewSeo.getSeoById)
    .post('/newSeo', manageNewSeo.addOrEditSeo)
    .put('/newSeo/:seoId', manageNewSeo.addOrEditSeo)
    .delete('/newSeo/:seoId', manageNewSeo.deleteSeo)

export default router;
