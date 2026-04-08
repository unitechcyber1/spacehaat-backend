import express from 'express';
const router = express.Router();
import manageBrand from '../../controllers/admin/ManageBrand.js';

router.get('/workSpacesByBrand/:slug', manageBrand.getSpacesByBrand)
    .get('/colivingByBrand/:slug', manageBrand.getColivingByBrand)
    .get('/workSpacesByBrandName/:name', manageBrand.getBrandByName)
    .get('/workSpacesByBrand/:slug/:city', manageBrand.getSpacesByBrandAndCity)
    .get('/brands', manageBrand.getBrands)

export default router;