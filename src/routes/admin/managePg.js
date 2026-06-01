import { Router } from 'express';

const router = Router();
import managePg from '../../controllers/admin/ManagePg.js';

router
    .get('/pgs', managePg.getPgs)
    .get('/pg/:pgId', managePg.getPgById)
    .post('/pg', managePg.createOrUpdatePg)
    .put('/pg/:id', managePg.createOrUpdatePg)
    .post('/pg/changeStatus/:pgId', managePg.changePgStatus)
    .get('/pg/priority/type', managePg.getPriorityPgs)
    .post('/pg/priority', managePg.addPriorityPgs)
    .post('/pg/priority/changeOrder', managePg.setPriorityByType)
    .put('/pg/priority/drag', managePg.pgOrderByDrag)
    .delete('/pg/:id', managePg.deletePg);

export default router;
