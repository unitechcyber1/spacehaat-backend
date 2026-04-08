import manageWhatsappService from '../../services/admin/manage-whatsapp.js';

class ManageWhatsappController {
    constructor() {
        return {
            twilioWebhook: this.twilioWebhook.bind(this),
            sendMessage: this.sendMessage.bind(this),
            getMessages: this.getMessages.bind(this),
            getConversation: this.getConversation.bind(this),
            getSessionStatus: this.getSessionStatus.bind(this),
            markSeen: this.markSeen.bind(this)
        };
    }

    async twilioWebhook(req, res, next) {
        try {
            const body = req.body?.Body ?? req.body?.body ?? '';
            const from = req.body?.From ?? req.body?.from ?? '';
            const messageSid = req.body?.MessageSid ?? req.body?.MessageSid ?? '';
            console.log('Twilio WhatsApp webhook received:', {
                from,
                messageSid,
                hasBody: !!body
            });
            if (!from || !messageSid) {
                return res.status(400).send('Missing From or MessageSid');
            }

            await manageWhatsappService.handleInboundMessage({
                phone: String(from),
                message: String(body),
                messageSid: String(messageSid),
                status: req.body?.SmsStatus || req.body?.MessageStatus
            });

            res.status(200).send();
        } catch (error) {
            next(error);
        }
    }

    async sendMessage(req, res, next) {
        try {
            const { phone, message } = req.body || {};

            if (!phone || !message) {
                return res.status(400).json({
                    message: 'phone and message are required'
                });
            }

            const result = await manageWhatsappService.sendOutboundMessage({
                phone: String(phone),
                message: String(message)
            });

            return res.status(200).json({
                success: true,
                mode: result.mode,
                sid: result.sid
            });
        } catch (error) {
            next(error);
        }
    }

    async getMessages(req, res, next) {
        try {
            const phone = req.params.phone;
            if (!phone) {
                return res.status(400).json({ message: 'phone is required' });
            }
            const result = await manageWhatsappService.getMessagesByPhone({
                phone: decodeURIComponent(phone),
                direction: 'inbound'
            });
            return res.status(200).json({
                message: 'WhatsApp messages',
                data: result.messages,
                total: result.total
            });
        } catch (error) {
            next(error);
        }
    }

    async getConversation(req, res, next) {
        try {
            const phone = req.params.phone;
            if (!phone) {
                return res.status(400).json({ message: 'phone is required' });
            }
            const result = await manageWhatsappService.getConversationByPhone({
                phone: decodeURIComponent(phone)
            });
            return res.status(200).json({
                message: 'WhatsApp conversation',
                data: result.messages,
                total: result.total
            });
        } catch (error) {
            next(error);
        }
    }

    async getSessionStatus(req, res, next) {
        try {
            const phone = req.params.phone;
            if (!phone) {
                return res.status(400).json({ message: 'phone is required' });
            }

            const status = await manageWhatsappService.getSessionStatus({
                phone: decodeURIComponent(phone)
            });

            // Lead not found
            if (!status) {
                return res.status(400).json({
                    message: 'Lead not found for given phone'
                });
            }

            return res.status(200).json(status);
        } catch (error) {
            next(error);
        }
    }

    async markSeen(req, res, next) {
        try {
            const { phone } = req.body || {};
            if (!phone) {
                return res.status(400).json({ message: 'phone is required' });
            }

            await manageWhatsappService.markSeen({ phone: String(phone) });

            return res.status(200).json({ success: true });
        } catch (error) {
            next(error);
        }
    }
}

export default new ManageWhatsappController();
