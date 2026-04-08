import { Router } from 'express';
const router = Router();
import manageCoLivingSapce from '../../controllers/admin/ManageCoLivingSapce.js';
import manageUserCoLivingSapce from '../../controllers/user/ManageCoLivingSpace.js';
// import manageUserOfficeSpace from '../../controllers/user/ManageOfficeSpace';

router.get('/coLivingSpaces', manageCoLivingSapce.getCoLivingSpaces)
    .get('/coLivingSpaces/:coLivingSpaceId', manageCoLivingSapce.getCoLivingSpaceById)
    .get('/usercoLivingSpaces/:coLivingSpaceId', manageCoLivingSapce.getUserCoLivingSpaceById)
    .post('/coLivingSpaces', manageCoLivingSapce.createOrUpdateCoLivingSpace)
    .put('/coLivingSpaces/:id', manageCoLivingSapce.createOrUpdateCoLivingSpace)
    .put('/coLivingSpaces/priority/location/:id', manageCoLivingSapce.changeProjectOrder)
    .post('/coLivingSpaces/changeStatus/:coLivingSpaceId', manageCoLivingSapce.changeCoLivingSpaceStatus)
    .delete('/coLivingSpaces/:id', manageCoLivingSapce.deleteCoLivingSpace)
    // .post('/coLiving/popular', manageOfficeSapce.addPopularcoLiving)
    // .get('/coLiving/popular/space', manageUserOfficeSpace.getPopularcoLiving)
    // .post('/coLiving/popular/changeOrder', manageOfficeSapce.sortPopularcoLiving)
    .get('/coLivingSpaces/priority/type', manageUserCoLivingSapce.getPriorityCoLivingSpaces)
    .get('/coLivingSpaces/priority/:id', manageCoLivingSapce.getProjectbyMicrolocationWithPriority)
    .post('/coLivingSpaces/priority', manageCoLivingSapce.addPriorityCoLivingSpaces)
    .post('/coLivingSpaces/priority/changeOrder', manageCoLivingSapce.setPriorityByType)
    .put('/coLivingSpaces/priority/drag', manageCoLivingSapce.spaceOrderByDrag)
    .put('/coLivingSpaces/priority/loc/drag', manageCoLivingSapce.changeProjectOrderbyDrag)
    .post('/coLivingSpaces/bulkUpload', manageCoLivingSapce.uploadBulkCoLivingSpace)
    .put('/coLivingSpaces/slug/update', manageCoLivingSapce.changeSlugById)
    .get('/coLivingSpaces/popular', manageUserCoLivingSapce.getPopularPlacesByKey)

export default router;