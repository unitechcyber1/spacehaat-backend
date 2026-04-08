import { Router } from 'express';
const router = Router();
import manageBooking from '../../controllers/admin/ManageBooking.js';

router.get('/bookings', manageBooking.getBookings)
    .post('/booking/:id', manageBooking.getBookingById)

export default router;
