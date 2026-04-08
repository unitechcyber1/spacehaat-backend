import { Router } from 'express';
const router = Router();
import manageMicroLocation from '../../controllers/admin/ManageMicroLocation.js';

router.get('/microLocationByCitySpaceType', manageMicroLocation.microLocationByCityAndSpaceType)

export default router;