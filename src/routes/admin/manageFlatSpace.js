import { Router } from 'express';
const router = Router();
import manageFlatSapce from '../../controllers/admin/ManageFlatSapce.js';
import manageUserFlatSapce from '../../controllers/user/ManageFlatSpace.js';
// import manageUserOfficeSpace from '../../controllers/user/ManageOfficeSpace';

router.get('/FlatSpaces', manageFlatSapce.getFlatSpaces)
    .get('/FlatSpaces/:FlatSpaceId', manageFlatSapce.getFlatSpaceById)
    .get('/userFlatSpaces/:FlatSpaceId', manageFlatSapce.getuserFlatSpaceById)
    .post('/FlatSpaces', manageFlatSapce.createOrUpdateFlatSpace)
    .put('/FlatSpaces/:id', manageFlatSapce.createOrUpdateFlatSpace)
    .post('/FlatSpaces/changeStatus/:FlatSpaceId', manageFlatSapce.changeFlatSpaceStatus)
    .delete('/FlatSpaces/:id', manageFlatSapce.deleteFlatSpace)
    .post('/Flat/popular', manageFlatSapce.addPopularFlatSpaces)
    .get('/Flat/popular/space', manageUserFlatSapce.getPopularFlat)
    .post('/Flat/popular/changeOrder', manageFlatSapce.sortPopularFlatSpaces)
    .get('/FlatSpaces/priority/type', manageUserFlatSapce.getPriorityFlatSpaces)
    .post('/FlatSpaces/priority', manageFlatSapce.addPriorityFlatSpaces)
    .post('/FlatSpaces/priority/changeOrder', manageFlatSapce.setPriorityByType)
    .post('/FlatSpaces/bulkUpload', manageFlatSapce.uploadBulkFlatSpace)
    .put('/FlatSpaces/slug/update', manageFlatSapce.changeSlugById)
    // .get('/FlatSpaces/popular', manageUserFlatSapce.getPopularPlacesByKey)

export default router;