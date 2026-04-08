import express from 'express';
const router = express.Router();
import UserAuthController from '../../controllers/user/auth.js';

// create login routes
router.post('/signUp', UserAuthController.signUpUser)
    .post('/login', UserAuthController.login)
    .post('/validate', UserAuthController.validateUser)
    .post('/resendOTP', UserAuthController.resendOTP)
    .get('/logout', UserAuthController.logout)
    .post('/create', UserAuthController.createUser)
    .post('/vendorSignUp', UserAuthController.vendorSignUp)
    .post('/vendorLogin', UserAuthController.vendorLogin)
    .post('/validateVendor', UserAuthController.validateVendorUser)
    .post('/manageUser', UserAuthController.manageUser)
    .put('/updateUser', UserAuthController.updateUser)




export default router;