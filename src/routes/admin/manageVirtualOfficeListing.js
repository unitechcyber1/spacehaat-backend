import { Router } from 'express';
import manageVo from '../../controllers/admin/ManageVirtualOfficeListing.js';

const router = Router();

router.get('/virtualOfficeListings', manageVo.list)
    .get('/virtualOfficeListings/stats', manageVo.stats)
    .get('/virtualOfficeListings/:id', manageVo.get)
    .post('/virtualOfficeListings', manageVo.create)
    .put('/virtualOfficeListings/:id', manageVo.update)
    .delete('/virtualOfficeListings/:id', manageVo.remove);

export default router;
