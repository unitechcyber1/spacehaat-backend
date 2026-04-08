import { Router } from 'express';
const router = Router();
import manageAmenty from '../../controllers/admin/ManageAmenty.js';

router.get('/amenties', manageAmenty.getAmenties)
    .post('/amenty', manageAmenty.addOrEditAmenty)
    .put('/amenty/:amentyId', manageAmenty.addOrEditAmenty)
    .delete('/amenty/:amentyId', manageAmenty.deleteAmenty)
    .put('/amenty/priority/drag', manageAmenty.amentyOrderByDrag)

export default router;