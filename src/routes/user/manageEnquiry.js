import express from 'express';
const router = express.Router();
import EnquiryController from '../../controllers/user/ManageEnquiry.js';

router.post('/enquiry', EnquiryController.createEnquiry)
    .post('/enquiryWithoutLogin', EnquiryController.enquiryWithoutLogin)
    .get('/enquiries', EnquiryController.getEnquiriesByUser)
    .post('/enquiry/lead', EnquiryController.createLead)

export default router;