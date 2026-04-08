import express from 'express';
const router = express.Router();
import ManageUserController from '../../controllers/user/ManageUser.js';

router.put('/update', ManageUserController.updateUser)
    .post('/workspace/like', ManageUserController.likeOrDislikeWorkSpace)
    .get('/workspace/favourite', ManageUserController.getFavouriteByUser)
    .get('/profile', ManageUserController.getProfile)
    .get('/vendorProfile', ManageUserController.vendorProfile)
    .put('/updateVendor', ManageUserController.updateVendor)
    .get('/vendorDetails', ManageUserController.vendorDetails)




export default router;