import { Router } from 'express';
const router = Router();
import manageSubBuilder from '../../controllers/user/ManageSubBuilder.js';

router.get('/subbuilders', manageSubBuilder.getSubBuilders)
    .get('/subbuilders/findKey', manageSubBuilder.getSubBuildersById)
    .get('/apartmentForSaleAndRent', manageSubBuilder.getApartmentForRentOrSale)
    .get('/subbuilders/builder/location/', manageSubBuilder.getBuilderslocation)


export default router;