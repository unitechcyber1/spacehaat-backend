import RazorPay from 'razorpay';
import app from '../config/app.js';

class RazerPay {
    constructor() {
        this.razerPay = null;
        const key = app.razerPay.key?.trim();
        const secret = app.razerPay.secret?.trim();
        if (key && secret) {
            this.razerPay = new RazorPay({
                key_id: key,
                key_secret: secret,
            });
        } else {
            console.warn(
                '[RazerPay] RAZER_PAY_KEY / RAZER_PAY_SECRET not set — payment routes will fail until configured',
            );
        }
        return {
            createOrder: this.createOrder.bind(this),
            fetchPaymentByOderId: this.fetchPaymentByOderId.bind(this),
            capturePayment: this.capturePayment.bind(this),
            getOrderById: this.getOrderById.bind(this),
            validateWebhookSignature: this.validateWebhookSignature.bind(this),
        };
    }

    getClient() {
        if (!this.razerPay) {
            throw new Error(
                'Razorpay is not configured. Set RAZER_PAY_KEY and RAZER_PAY_SECRET in .env',
            );
        }
        return this.razerPay;
    }

    async createOrder({ amount, currency = 'INR', receipt = null, payment_capture = 0, notes = null }) {
        try {
            const order = await this.getClient().orders.create({
                amount,
                currency,
                receipt,
                payment_capture,
                notes,
            });
            return order;
        } catch (error) {
            throw error;
        }
    }

    async getOrderById(order_id) {
        try {
            const order = await this.getClient().orders.fetch(order_id);
            return order;
        } catch (error) {
            throw error;
        }
    }

    async fetchPaymentByOderId(orderId) {
        try {
            const payment = await this.getClient().orders.fetchPayments(orderId);
            return payment;
        } catch (error) {
            throw error;
        }
    }

    async capturePayment({ payment_id, amount, currency = 'INR' }) {
        try {
            const capture = await this.getClient().payments.capture(payment_id, amount, currency);
            return capture;
        } catch (error) {
            throw error;
        }
    }

    async validateWebhookSignature(webhook_body, webhook_signature) {
        try {
            const webhookSecret = app.razerPay.webHookSecretKey?.trim();
            if (!webhookSecret) {
                throw new Error(
                    'Razorpay webhook secret is not configured. Set RAZER_PAY_WEB_HOOK_SECRET in .env',
                );
            }
            const { order_id: order, notes: items, id: payment, status } =
                webhook_body.payload.payment.entity;
            webhook_signature = webhook_signature['x-razorpay-signature'];
            const isSignatureMatched = await RazorPay.validateWebhookSignature(
                JSON.stringify(webhook_body),
                webhook_signature,
                webhookSecret,
            );
            if (isSignatureMatched) {
                return { order, items, payment, status };
            }
            return {};
        } catch (error) {
            throw error;
        }
    }
}

export default new RazerPay();
