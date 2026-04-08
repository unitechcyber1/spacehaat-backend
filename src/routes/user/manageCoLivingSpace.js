import express from 'express';
const router = express.Router();
import CoLivingSpaceController from '../../controllers/user/ManageCoLivingSpace.js';

router.get('/coLivingSpaces', CoLivingSpaceController.getCoLivingSpaces)
    .get('/coLivingSpaces/:findKey', CoLivingSpaceController.getCoLivingSpaceById)
    // .get('/popularCoLivingSpaces', OfficeSpaceController.getPopularOfficeSpaces)
    // .get('/similarCoLivingPlace/:findKey', OfficeSpaceController.getSimilarPlacesByLocation)
    .get('/popularCoLivingSpaces', CoLivingSpaceController.getPopularPlacesByKey)
    .post('/popularColivingSpacesCountryWise', CoLivingSpaceController.getPopularColivingSpacesCountryWise)
    .get('/coLivingSpaces/priority/type', CoLivingSpaceController.getPriorityCoLivingSpaces1)
    .get('/nearBySpaces', CoLivingSpaceController.getNearBySpaces)


export default router;