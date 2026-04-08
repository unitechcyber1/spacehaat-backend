import express from 'express';
const router = express.Router();
import FlatSpaceController from '../../controllers/user/ManageFlatSpace.js';

router.get('/FlatSpaces', FlatSpaceController.getFlatSpaces)
    .get('/FlatSpaces/:findKey', FlatSpaceController.getFlatSpaceById)
    .get('/popularFlatSpaces', FlatSpaceController.getPopularFlatSpaces)
    // .get('/similarFlatPlace/:findKey', OfficeSpaceController.getSimilarPlacesByLocation)
    .get('/popularFlatSpaces', FlatSpaceController.getPopularPlacesByKey)
    .post('/popularFlatSpacesCountryWise', FlatSpaceController.getPopularFlatSpacesCountryWise)
    .get('/FlatSpaces/priority/type', FlatSpaceController.getPriorityFlatSpaces)

export default router;