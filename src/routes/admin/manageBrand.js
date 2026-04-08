import { Router } from 'express';
const router = Router();
import manageBrand from '../../controllers/admin/ManageBrand.js';

router.get('/brands', manageBrand.getBrands)
    .get('/brand/:id', manageBrand.getBrandById)
    .post('/brand', manageBrand.addOrEditBrand)
    .put('/brand/:brandId', manageBrand.addOrEditBrand)
    .delete('/brand/:brandId', manageBrand.deleteOneBrand)

export default router;