import { Router } from 'express';
const router = Router();
import manageWorkSpace from '../../controllers/admin/ManageWorkSpace.js';
import manageUserWorkSpace from '../../controllers/user/ManageWorkSpace.js';
import fileUploadMiddleware from '../../controllers/common/fileUpload.js';


router.get('/workSpaces', manageWorkSpace.getWorkSpaces)
    .get('/workSpace/:workSpaceId', manageWorkSpace.getWorkSpaceById)
    .get('/userworkSpace/:workSpaceId', manageWorkSpace.getuserWorkSpaceById)
    .post('/workSpace', manageWorkSpace.createOrUpdateWorkSpace)
    .put('/workSpace/:id', manageWorkSpace.createOrUpdateWorkSpace)
    .post('/workSpace/changeStatus/:workSpaceId', manageWorkSpace.changeWorkSpaceStatus)
    .post('/upload', fileUploadMiddleware.uploadFile)
    .put('/upload', fileUploadMiddleware.updateImage)
    .put('/calendar', manageWorkSpace.updateCalendar)
    .post('/file/delete', fileUploadMiddleware.deleteFile)
    .post('/workSpace/bulkUpload', manageWorkSpace.uploadBulkWorkSpace)
    .post('/workSpace/popular', manageWorkSpace.addPopularWorkSpaces)
    .post('/workSpace/priority', manageWorkSpace.addPriorityWorkSpaces)
    .get('/workSpace/popular/space', manageUserWorkSpace.getPopularWorkSpaces)
    .get('/workSpace/priority/type', manageUserWorkSpace.getPriorityWorkSpaces)
    .post('/workSpace/popular/changeOrder', manageWorkSpace.sortPopularWorkSpaces)
    .post('/workSpace/priority/changeOrder', manageWorkSpace.setPriorityByType)
    .put('/workSpace/priority/drag', manageWorkSpace.spaceOrderByDrag)
    .delete('/workSpace/:id', manageWorkSpace.deleteWorkSpace)
    .post('/workspaces/addproperty', manageWorkSpace.updatePlanProperty)
    .put('/workspaces/slug/update', manageWorkSpace.changeSlugById)
    .get('/workSpaces/popular', manageUserWorkSpace.getPopularPlacesByKey)
    .get('/totalProperties', manageWorkSpace.totalProperties)
    .get('/allSpacesAddedBySellerAccount', manageWorkSpace.allSpacesAddedBySellerAccount)
    .put('/lisingAccess', manageWorkSpace.listingAccess)

export default router;