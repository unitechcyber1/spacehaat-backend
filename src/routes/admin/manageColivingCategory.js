import { Router } from 'express';
const router = Router();
import ManageColivigCategory from '../../controllers/admin/ManageColivingCategory.js';

router.get('/getColivingCategory', ManageColivigCategory.getColivingPlans)
    .post('/colivingCategory', ManageColivigCategory.addOrEditColivingPlans)
    .put('/colivingCategory/:categoryId', ManageColivigCategory.addOrEditColivingPlans)
    .get('/colivingCategory/:id', ManageColivigCategory.getColivingPlansById)
    .get('/Active_colivingCategory', ManageColivigCategory.ActiveColivingPlans)
    .get('/colivingCategory/changeStatus/:categoryId', ManageColivigCategory.toggleColivingPlansStatus)
    .delete('/colivingCategory/:categoryId', ManageColivigCategory.deleteColivingPlans)

export default router;