import RazorPay from 'razorpay';
import app from '../config/app.js';

class RazerPay {
    constructor() {
        this.razerPay = new RazorPay({
            key_id: app.razerPay.key,
            key_secret: app.razerPay.secret,
        });
        return {
            createOrder: this.createOrder.bind(this),
            fetchPaymentByOderId: this.fetchPaymentByOderId.bind(this),
            capturePayment: this.capturePayment.bind(this),
            getOrderById: this.getOrderById.bind(this),
            validateWebhookSignature: this.validateWebhookSignature.bind(this)
        }
    }

    async createOrder({ amount, currency = 'INR', receipt = null, payment_capture = 0, notes = null }) {
        try {
            const order = await this.razerPay.orders
                .create({ amount, currency, receipt, payment_capture, notes })
            return order;
        } catch (error) {
            throw (error);
        }
    }

    async getOrderById(order_id) {
        try {
            const order = await this.razerPay.orders.fetch(order_id);
            return order;
        } catch (error) {
            throw (error);
        }
    }

    async fetchPaymentByOderId(orderId) {
        try {
            const payment = await this.razerPay.orders.fetchPayments(orderId);
            return payment;
        } catch (error) {
            throw (error);
        }
    }

    async capturePayment({payment_id, amount, currency = "INR"}) {
        try {

            const capture = await this.razerPay.payments.capture(payment_id, amount, currency);
            return capture;
        } catch (error) {
            throw (error);
        }
    }

    async validateWebhookSignature(webhook_body, webhook_signature) {
        try {
            const { order_id: order, notes: items, id: payment, status } = webhook_body.payload.payment.entity;
            webhook_signature = webhook_signature["x-razorpay-signature"];
            const webhook_secret = app.razerPay.webHookSecretKey;
            const isSignatureMatched = await RazorPay.validateWebhookSignature(
                JSON.stringify(webhook_body),
                webhook_signature,
                webhook_secret
            );
            if (isSignatureMatched) {
                return { order, items, payment, status };
            };
            return {};
        } catch (error) {
            throw (error);
        }
    }
}

export default new RazerPay();