import { Router } from 'express';
const router = Router();
import ManageStudentHousing from '../../controllers/admin/ManageStudentHousing.js';
import ManageStudentHousingSpace from '../../controllers/user/ManageStudentHousingSpace.js';
// import manageUserOfficeSpace from '../../controllers/user/ManageOfficeSpace';

router.get('/StudentHousingSpaces', ManageStudentHousing.getStudentHousingSpaces)
    .get('/StudentHousingSpaces/:StudentHousingSpaceId', ManageStudentHousing.getStudentHousingSpaceById)
    .post('/StudentHousingSpaces', ManageStudentHousing.createOrUpdateStudentHousingSpace)
    .put('/StudentHousingSpaces/:id', ManageStudentHousing.createOrUpdateStudentHousingSpace)
    .post('/StudentHousingSpaces/changeStatus/:StudentHousingSpaceId', ManageStudentHousing.changeStudentHousingSpaceStatus)
    .delete('/StudentHousingSpaces/:id', ManageStudentHousing.deleteStudentHousingSpace)
    // .post('/StudentHousing/popular', manageOfficeSapce.addPopularStudentHousing)
    // .get('/StudentHousing/popular/space', manageUserOfficeSpace.getPopularStudentHousing)
    // .post('/StudentHousing/popular/changeOrder', manageOfficeSapce.sortPopularStudentHousing)
    .get('/StudentHousingSpaces/priority/type', ManageStudentHousingSpace.getPriorityStudentHouseSpaces)
    .post('/StudentHousingSpaces/priority', ManageStudentHousing.addPriorityStudentHousingSpaces)
    .post('/StudentHousingSpaces/priority/changeOrder', ManageStudentHousing.setPriorityByType)
    .post('/StudentHousingSpaces/bulkUpload', ManageStudentHousing.uploadBulkStudentHousingSpace)
    .put('/StudentHousingSpaces/slug/update', ManageStudentHousing.changeSlugById)
    .get('/StudentHousingSpaces/popular', ManageStudentHousingSpace.getPopularPlacesByKey)

export default router;