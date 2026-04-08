
import express from 'express';
const router = express.Router();
import StudentHousingSpaceController from '../../controllers/user/ManageStudentHousingSpace.js';

router.get('/StudentHousingSpaces', StudentHousingSpaceController.getStudentHouseSpaces)
    .get('/StudentHousingSpaces/:findKey', StudentHousingSpaceController.getStudentHouseSpaceById)
    // .get('/popularStudentHousingSpaces', OfficeSpaceController.getPopularOfficeSpaces)
    // .get('/similarStudentHousingPlace/:findKey', OfficeSpaceController.getSimilarPlacesByLocation)
    .get('/popularStudentHousingSpaces', StudentHousingSpaceController.getPopularPlacesByKey)

export default router;
