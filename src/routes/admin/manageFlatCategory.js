import { Router } from 'express';
const router = Router();
import ManageFlatPlans from '../../controllers/admin/ManageFlatCategory.js';

router.get('/getFlatCategory', ManageFlatPlans.getFlatPlans)
    .post('/FlatCategory', ManageFlatPlans.addOrEditFlatPlans)
    .put('/FlatCategory/:categoryId', ManageFlatPlans.addOrEditFlatPlans)
    .get('/FlatCategory/:id', ManageFlatPlans.getFlatPlansById)
    .get('/Active_FlatCategory', ManageFlatPlans.ActiveFlatPlans)
    .get('/FlatCategory/changeStatus/:categoryId', ManageFlatPlans.toggleFlatPlansStatus)
    .delete('/FlatCategory/:categoryId', ManageFlatPlans.deleteFlatPlans)

export default router;