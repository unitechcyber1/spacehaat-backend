import { Router } from 'express';

const router = Router();
import managePg from '../../controllers/admin/ManagePg.js';

router
    .get('/pgs', managePg.getPgs)
    .get('/pg/:pgId', managePg.getPgById)
    .post('/pg', managePg.createOrUpdatePg)
    .put('/pg/:id', managePg.createOrUpdatePg)
    .post('/pg/changeStatus/:pgId', managePg.changePgStatus)
    .delete('/pg/:id', managePg.deletePg);

export default router;
