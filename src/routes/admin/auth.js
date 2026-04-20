import express from 'express';
const router = express.Router();
import AdminAuthController from '../../controllers/admin/auth.js';

// create login routes
router
    // .post('/createAdmin', AdminAuthController.createAdmin)
    .post('/login', AdminAuthController.login)
    .get('/logout', AdminAuthController.logout)
    .get('/userList', AdminAuthController.userList)
    .get('/user/:id', AdminAuthController.userData)
    .delete('/deleteUser/:userId', AdminAuthController.deleteUser)
    .delete('/deleteUserByPhone/:mobile', AdminAuthController.deleteUserByPhoneNumber)
    .post('/forgotAdminPwd',AdminAuthController.forgotPwd)
    .post('/sendOtpAdminUser', AdminAuthController.sendOTP)
    .post('/validateAdminUser', AdminAuthController.validateUser)
    .put('/updateUser', AdminAuthController.updateUser)
    .put('/updateAccess', AdminAuthController.updateAccess)
    .post('/welcome-msg', AdminAuthController.welcomeMessage)





export default router;