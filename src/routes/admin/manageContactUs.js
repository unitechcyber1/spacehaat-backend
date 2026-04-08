import { Router } from 'express';
const router = Router();
import manageContactUs from '../../controllers/admin/ManageContactUs.js';

router.get('/contactUs', manageContactUs.getContactUs)

export default router;
