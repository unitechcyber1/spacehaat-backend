import express from 'express';
const router = express.Router();
import WorkSpaceController from '../../controllers/user/ManageWorkSpace.js';
import manageCity from '../../controllers/admin/ManageCity.js';
import ManageWorkSpace from '../../controllers/admin/ManageWorkSpace.js';


router.get('/workSpaces', WorkSpaceController.getWorkSpaces)
    .get('/workSpace/:findKey', WorkSpaceController.getWorkSpaceById)
    .get('/cities', manageCity.getCities)
    .get('/popularWorkSpaces', WorkSpaceController.getPopularWorkSpaces)
    .post('/workSpaces_country_wise', WorkSpaceController.getWorkSpaces_country_wise)
    .post('/popularWorkSpacesCountryWise', WorkSpaceController.getPopularWorkSpacesCountryWise)
    .post('/WorkSpacesCountryWise', WorkSpaceController.getWorkSpacesCountryWise)
    .get('/similarPlace/:findKey', WorkSpaceController.getSimilarPlacesByLocation)
    .get('/workSpaces/popular', WorkSpaceController.getPopularPlacesByKey)
    .get('/workSpaces/nearBySpaces', WorkSpaceController.getNearBySpaces)
    .put('/workSpace/calendar', ManageWorkSpace.updateCalendar)

export default router;