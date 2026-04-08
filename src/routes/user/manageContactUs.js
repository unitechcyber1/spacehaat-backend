import { Router } from 'express';
const router = Router();
import manageContactUs from '../../controllers/admin/ManageContactUs.js';

router.post('/contactUs', manageContactUs.createContactUs)

export default router;
