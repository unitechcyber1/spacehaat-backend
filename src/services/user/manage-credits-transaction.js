import razerPay from '../../utilities/razerPay.js';
import models from '../../models/index.js';
import crypto from 'crypto';
import aws from '../../utilities/aws.js';
import app from '../../config/app.js';
import moment from 'moment';
const CreditTransaction = models['CreditTransaction'];
const CoLivingSpace = models['CoLivingSpace'];
const User = models['User'];

class ManageCreditsTransaction {
    constructor() {
        return {
            createCreditsTransaction: this.createCreditsTransaction.bind(this),
            capturedPayment: this.capturedPayment.bind(this),
            // validateWebhookSignature: this.validateWebhookSignature.bind(this),
            // getPayments: this.getPayments.bind(this),
            // getBookingsByUser: this.getBookingsByUser.bind(this),
            // getBookingsById: this.getBookingsById.bind(this)
        }
    }

    async createCreditsTransaction({ currency, coliving, user_id, amount, credits }) {
        try {
            const receipt = `receipt #${crypto.randomBytes(3).toString('hex')}`;
            const currentDate = moment().format('DDMMYYHHmmss');
            const bookingId = currentDate.slice(4, 12);
            let amountInPaisa = await this._verifyAmountCheck(coliving, amount);
            amountInPaisa = +amountInPaisa.toFixed(2);
            const notes = { amountInPaisa, coliving, user: user_id };
            const order = await razerPay.createOrder({ amount: amountInPaisa, currency, receipt, notes });
            const uploadPayload = {
                order: order.id,
                amount: amountInPaisa / 100,
                credits,
                user: user_id,
                bookingId: bookingId
            }
            if (coliving) {
                uploadPayload.coliving = coliving
            }
            const booking = await CreditTransaction.create(uploadPayload);
            return { order_id: order.id, booking_id: booking.id, amount: amountInPaisa / 100 };
        } catch (error) {
            throw (error);
        }
    }

    // async capturedPayment({ booking_id, payment_id, amount, currency }) {
    //     try {
    //         await razerPay.capturePayment({ payment_id, amount, currency });
    //         const booking = await CreditTransaction.findOneAndUpdate(
    //             { _id: booking_id },
    //             {
    //                 payment: payment_id,
    //                 status: 'success',
    //             },
    //             { new: true }
    //         );
    //         if (!booking) {
    //             throw new Error('Booking not found or failed to update.');
    //         }
    //         const user = await User.findById(booking.user);
    //         if (!user) {
    //             throw new Error('User not found.');
    //         }
    //         const mailParams = this.createMailParams(user, booking);
    //         await aws.sendMail(mailParams.userParams);
    //         return booking;
    //     } catch (error) {
    //         console.error('Error in capturedPayment:', error);
    //         throw error;
    //     }
    // }
    async capturedPayment({ booking_id, payment_id, amount, currency }) {
        try {
            const existingTransaction = await CreditTransaction.findOne({
                _id: booking_id,
                payment: payment_id,
                status: 'success'
            });
            if (existingTransaction) {
                return existingTransaction;
            }
            const booking = await CreditTransaction.findOneAndUpdate(
                { _id: booking_id },
                {
                    payment: payment_id,
                    status: 'success'
                },
                { new: true }
            );

            if (!booking) {
                throw new Error('Credit transaction not found or failed to update.');
            }
            const user = await User.findById(booking.user);
            if (!user) {
                throw new Error('User not found.');
            }
            const mailParams = this.createMailParams(user, booking);
            await aws.sendMail(mailParams.userParams);

            return booking;

        } catch (error) {
            console.error('Error in capturedPayment:', error);
            throw error;
        }
    }


    createMailParams(user, booking) {
        const htmlVariables = {
            credits: booking?.credits || 0,
            name: (user?.name || 'User').toUpperCase(),
        };
        return {
            userParams: {
                toEmails: [user?.email || ''],
                templateName: 'coliving_credits',
                htmlVariables,
                subjectVariables: {
                    credits: booking?.credits || 0,
                },
                bccAddresses: [],
                ccAddresses: [],
            },
        };
    }

    // async validateWebhookSignature(webhook_body, webhook_signature) {
    //     try {
    //         const result = await razerPay.validateWebhookSignature(webhook_body, webhook_signature);
    //         if (Object.keys(result).length) {
    //             if (result.status === 'authorized') {
    //                 return result;
    //             }
    //             const booking = await Booking.findOneAndUpdate({ order: result.order }, {
    //                 payment: result.payment,
    //                 status: result.status
    //             }, { new: true });
    //             return booking;
    //         }
    //         return result;
    //     } catch (error) {
    //         throw (error);
    //     }
    // }

    // async getPayments({ id: userId }) {
    //     try {
    //         const payments = await Booking.find({ user: userId, status: 'success' }, { visitors: 0 });
    //         return payments;
    //     } catch (error) {
    //         throw (error);
    //     }
    // }

    // async getBookingsByUser({ id: userId }) {
    //     try {
    //         const bookings = await Booking.find({ user: userId, status: 'success' })
    //             .populate({ path: 'work_space', select: 'location images _id name', populate: 'images' });
    //         return bookings;
    //     } catch (error) {
    //         throw (error);
    //     }
    // }
    // async getBookingsById({ id }) {
    //     try {
    //         const bookings = await Booking.findOne({ _id: id })
    //             .populate({ path: 'work_space', select: 'location images _id name slug', populate: 'images.image' });
    //         return bookings;
    //     } catch (error) {
    //         throw (error);
    //     }
    // }

    async _verifyAmountCheck(coliving, amount) {
        try {
            // const ColivingSpace = await CoLivingSpace.findOne({ _id: coliving });
            // if (ColivingSpace) {
            const gst = (amount * 18) / 100;
            // return (amount + gst) * 100;
            return amount * 100;
            // }
        } catch (error) {
            throw (error);
        }
    }

}

export default new ManageCreditsTransaction();