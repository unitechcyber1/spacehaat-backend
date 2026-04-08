import razerPay from '../../utilities/razerPay.js';
import models from '../../models/index.js';
import crypto from 'crypto';
import aws from '../../utilities/aws.js';
import app from '../../config/app.js';
import moment from 'moment';
const Booking = models['Booking'];
const WorkSpace = models['WorkSpace'];
const User = models['User'];
const CoLivingSpace = models['CoLivingSpace'];


class ManageBookingService {
    constructor() {
        return {
            createOrder: this.createOrder.bind(this),
            capturedPayment: this.capturedPayment.bind(this),
            validateWebhookSignature: this.validateWebhookSignature.bind(this),
            getPayments: this.getPayments.bind(this),
            getBookingsByUser: this.getBookingsByUser.bind(this),
            getBookingsById: this.getBookingsById.bind(this)
        }
    }

    async createOrder({ count, currency, from, to, month, category, gstDetails, bookingDates, visitors = [], work_space, user_id }) {
        try {
            const receipt = `receipt #${crypto.randomBytes(3).toString('hex')}`;
            let no_of_period = bookingDates.length;
            const currentDate = moment().format('DDMMYYHHmmss');
            const bookingId = currentDate.slice(4, 12);
            let amountInPaisa = await this._verifyAmountCheck(work_space, category, count, no_of_period);
            amountInPaisa = +amountInPaisa.toFixed(2);
            const notes = { amountInPaisa, bookingDates, category, work_space, user: user_id };
            const order = await razerPay.createOrder({ amount: amountInPaisa, currency, receipt, notes });
            const booking = await Booking.create({
                order: order.id,
                amount: amountInPaisa / 100,
                count,
                bookingDates,
                gstDetails,
                category,
                visitors,
                work_space,
                user: user_id,
                bookingId: bookingId
            });
            return { order_id: order.id, booking_id: booking.id, amount: amountInPaisa / 100 };
        } catch (error) {
            throw (error);
        }
    }

    // async capturedPayment({ booking_id, payment_id, amount, currency }) {
    //     try {
    //         await razerPay.capturePayment({ payment_id, amount, currency });
    //         const status = 'success';
    //         const booking = await Booking.findOneAndUpdate({ _id: booking_id }, {
    //             payment: payment_id,
    //             status
    //         }, { new: true }).populate('category');
    //         const user = await User.findOne({ _id: booking.user });
    //         const workSpace = await WorkSpace.findOne({ _id: booking.work_space });
    //         const obj = this.createMailParams(user, workSpace, booking);
    //         await aws.sendMail(obj.userParams);
    //         await aws.sendMail(obj.adminParams);
    //         return booking;
    //     } catch (error) {
    //         throw (error);
    //     }
    // }
    async capturedPayment({ booking_id, payment_id, amount, currency }) {
        try {
            // // 1️⃣ Fetch payment status from Razorpay
            // const payment = await razerPay.fetchPayment(payment_id);

            // // 2️⃣ Capture ONLY if authorized
            // if (payment.status === 'authorized') {
            //     await razerPay.capturePayment({
            //         payment_id,
            //         amount,
            //         currency
            //     });
            // }

            // // 3️⃣ Prevent duplicate DB update (VERY IMPORTANT)
            const existingBooking = await Booking.findOne({
                _id: booking_id,
                payment: payment_id
            });

            if (existingBooking) {
                // Already processed
                return existingBooking;
            }

            // 4️⃣ Update booking
            const booking = await Booking.findOneAndUpdate(
                { _id: booking_id },
                {
                    payment: payment_id,
                    status: 'success'
                },
                { new: true }
            ).populate('category');

            // 5️⃣ Send mails only ONCE
            const user = await User.findById(booking.user);
            const workSpace = await WorkSpace.findById(booking.work_space);

            const obj = this.createMailParams(user, workSpace, booking);
            await aws.sendMail(obj.userParams);
            await aws.sendMail(obj.adminParams);

            return booking;

        } catch (error) {
            throw error;
        }
    }


    createMailParams(user, workSpace, booking) {
        let date = new Date(booking.added_on);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        let bookedDates = booking.bookingDates.map(date => moment(date).format('D MMM (ddd)')).join(', ');
        const category = booking.category.name.split('-').join(' ');
        let htmlVariables = {
            bookingId: booking.bookingId,
            name: user.name.toUpperCase(),
            centerName: workSpace.name,
            location: workSpace.location.address1,
            date: date.toLocaleDateString("en-US", options),
            time: date.toLocaleTimeString('en-US'),
            visitors: booking.count,
            bookingDates: bookedDates,
            opentiming: workSpace.hours_of_operation['monday'].from,
            closetiming: workSpace.hours_of_operation['monday'].to,
            amount: booking.amount,
            paymentMode: 'Online',
            category: this._toTitleCase(category)
        }
        return {
            adminParams: {
                toEmails: [app.adminEmail],
                templateName: 'adminPassBook',
                htmlVariables,
                subjectVariables: { centerName: workSpace.name, category },
                bccAddresses: [],
                ccAddresses: []
            },
            userParams: {
                toEmails: [user.email],
                templateName: 'passBook',
                htmlVariables,
                subjectVariables: { centerName: workSpace.name, category },
                bccAddresses: [],
                ccAddresses: []
            }
        }
    }

    async validateWebhookSignature(webhook_body, webhook_signature) {
        try {
            const result = await razerPay.validateWebhookSignature(webhook_body, webhook_signature);
            if (Object.keys(result).length) {
                if (result.status === 'authorized') {
                    return result;
                }
                const booking = await Booking.findOneAndUpdate({ order: result.order }, {
                    payment: result.payment,
                    status: result.status
                }, { new: true });
                return booking;
            }
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async getPayments({ id: userId }) {
        try {
            const payments = await Booking.find({ user: userId, status: 'success' }, { visitors: 0 });
            return payments;
        } catch (error) {
            throw (error);
        }
    }

    async getBookingsByUser({ id: userId }) {
        try {
            const bookings = await Booking.find({ user: userId, status: 'success' })
                .populate({ path: 'work_space', select: 'location images _id name', populate: 'images' });
            return bookings;
        } catch (error) {
            throw (error);
        }
    }
    async getBookingsById({ id }) {
        try {
            const bookings = await Booking.findOne({ _id: id })
                .populate({ path: 'work_space', select: 'location images _id name slug', populate: 'images.image' });
            return bookings;
        } catch (error) {
            throw (error);
        }
    }

    async _verifyAmountCheck(workSpaceId, category, count, no_of_period) {
        try {
            const workSpace = await WorkSpace.findOne({ _id: workSpaceId });
            if (!workSpace) {
                return await this.calculateColivingAmount({ workSpaceId, category, count, no_of_period });
            } else {
                const plan = workSpace.plans.find(space => space.category.toString() === category.toString());
                if (!plan) {
                    this._throwException(`${category} is not available in this workspace`);
                }
                const gst = (plan.price * no_of_period * count * 18) / 100;
                // return (plan.price * no_of_period * count + gst) * 100;
                return (plan.price * no_of_period * count + gst) * 100
            }
        } catch (error) {
            throw (error);
        }
    }

    async calculateColivingAmount({ workSpaceId, category, count, no_of_period }) {
        try {
            const coliving = await CoLivingSpace.findOne({ _id: workSpaceId });
            if (!coliving) {
                this._throwException('workSpace not found');
            }
            const price = coliving.price[category];
            if (!price) {
                this._throwException(`${category} is not available in this Coliving Space`);
            }
            const gst = (price * no_of_period * count * 18) / 100;
            return (price * no_of_period * count + gst) * 100;
        } catch (error) {
            throw (error);
        }
    }

    _differenceInDate(from, to) {
        const dateTo = new Date(to);
        const datefrom = new Date(from);
        if (this._datesAreOnSameDay(dateTo, datefrom)) {
            return 1;
        };
        const differenceInTime = dateTo.getTime() - datefrom.getTime();
        return Math.abs(differenceInTime / (1000 * 3600 * 24));
    }

    _datesAreOnSameDay(first, second) {
        return first.getFullYear() === second.getFullYear() &&
            first.getMonth() === second.getMonth() &&
            first.getDate() === second.getDate();
    }

    _toTitleCase(phrase) {
        return phrase
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    _throwException(message) {
        throw ({
            name: "cofynd",
            code: 400,
            message
        })
    }
}

export default new ManageBookingService();