import manageBookingService from '../../services/admin/manage-booking.js';

class ManageBooking {
    constructor() {
        return {
            getBookings: this.getBookings.bind(this),
            getBookingById: this.getBookingById.bind(this)
        }
    }

    async getBookings(req, res, next) {
        try {
            const result = await manageBookingService.getBookings(req.query);
            res.status(200).json({
                message: 'Get Booking list',
                data: result.bookings,
                totalRecords: result.count
            })
        } catch (error) {
            next(error);
        }
    }

    async getBookingById(req, res, next) {
        try {
            const booking = await manageBookingService.getBookingById(req.params);
            res.status(200).json({
                message: 'Get Booking by id',
                data: booking
            })
        } catch (error) {
            next(error);
        }
    }

}

export default new ManageBooking();