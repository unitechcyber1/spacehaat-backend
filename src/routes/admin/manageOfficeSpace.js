import { Router } from 'express';
const router = Router();
import manageOfficeSapce from '../../controllers/admin/ManageOfficeSapce.js';
import manageUserOfficeSpace from '../../controllers/user/ManageOfficeSpace.js';

router.get('/officeSpaces', manageOfficeSapce.getOfficeSpaces)
    .get('/officeSpaces/:officeSpaceId', manageOfficeSapce.getOfficeSpaceById)
    .get('/userofficeSpaces/:officeSpaceId', manageOfficeSapce.userofficeSpaces)
    .post('/officeSpaces', manageOfficeSapce.createOrUpdateOfficeSpace)  
    .put('/officeSpaces/:id', manageOfficeSapce.createOrUpdateOfficeSpace)
    .put('/officeSpaces/priority/location/:id', manageOfficeSapce.changeProjectOrder)
    .post('/officeSpaces/changeStatus/:officeSpaceId', manageOfficeSapce.changeOfficeSpaceStatus)
    .delete('/officeSpaces/:id', manageOfficeSapce.deleteOfficeSpace)
    .post('/officeSpaces/popular', manageOfficeSapce.addPopularOfficeSpaces)
    .get('/officeSpaces/popular/space', manageUserOfficeSpace.getPopularOfficeSpaces)
    .post('/officeSpaces/popular/changeOrder', manageOfficeSapce.sortPopularOfficeSpaces)
    .get('/officeSpaces/priority/type', manageUserOfficeSpace.getPriorityOfficeSpaces)
    .get('/officeSpaces/priority/location/:id', manageOfficeSapce.getProjectbyMicrolocationWithPriority)
    .put('/officeSpaces/priority/drag', manageOfficeSapce.spaceOrderByDrag)
    .put('/officeSpaces/priority/loc/drag', manageOfficeSapce.changeProjectOrderbyDrag)
    .post('/officeSpaces/priority', manageOfficeSapce.addPriorityOfficeSpaces)
    .post('/officeSpaces/priority/changeOrder', manageOfficeSapce.setPriorityByType)
    .post('/officeSpaces/bulkUpload', manageOfficeSapce.uploadBulkOfficeSpace)
    .put('/officeSpaces/slug/update', manageOfficeSapce.changeSlugById)
    .get('/officeSpaces/popular', manageUserOfficeSpace.getPopularPlacesByKey)


export default router;