import models from '../../models/index.js';

const Booking = models['Booking'];

class ManageBookingService {
    constructor() {
        return {
            getBookingById: this.getBookingById.bind(this),
            getBookings: this.getBookings.bind(this),
        }
    }

    async getBookingById({ id }) {
        try {
            const booking = await Booking.findOne({ _id: id }).populate('image');
            return booking;
        } catch (error) {
            throw (error);
        }
    }

    async getBookings({ limit, skip, orderBy = 1, sortBy = 'added_on', name }) {
        try {
            const result = {};
            let condition = {};
            if (name) {
                name = '.*' + name + '.*';
                condition['name'] = { $regex: new RegExp('^' + name + '$', 'i') };
            }
            result.bookings = await Booking.find(condition)
                .populate('user')
                .populate('work_space')
                .populate('category')
                .limit(limit)
                .skip(skip)
                .sort({ [sortBy]: -1 });
            result.count = await Booking.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }

    _throwException(message) {
        throw ({
            name: "cofynd",
            code: 400,
            message
        })
    }
}

export default new ManageBookingService()