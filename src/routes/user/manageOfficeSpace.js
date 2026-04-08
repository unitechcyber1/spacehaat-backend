import express from 'express';
const router = express.Router();
import OfficeSpaceController from '../../controllers/user/ManageOfficeSpace.js';

router.get('/officeSpaces', OfficeSpaceController.getOfficeSpaces)
    .get('/officeSpaces/:findKey', OfficeSpaceController.getOfficeSpaceById)
    .get('/popularOfficeSpaces', OfficeSpaceController.getPopularOfficeSpaces)
    .get('/similarOfficePlace/:findKey', OfficeSpaceController.getSimilarPlacesByLocation)
    .get('/officeSpace/popular', OfficeSpaceController.getPopularPlacesByKey)
    .get('/officeSpace/nearBySpaces', OfficeSpaceController.getNearBySpaces)

export default router;