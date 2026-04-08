import express from 'express';
const router = express.Router();
import ManageBookingController from '../../controllers/user/ManageBooking.js';

router.post('/order', ManageBookingController.createOrder)
    .post('/payment', ManageBookingController.capturedPayment)
    .post('/payment/validate', ManageBookingController.validateWebhookSignature)
    .get('/payments', ManageBookingController.getPayments)
    .get('/bookings', ManageBookingController.getBookingsByUser)
    .get('/booking/:id', ManageBookingController.getBookingsById)

export default router;