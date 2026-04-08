import { Router } from 'express';
import twilio from 'twilio';
import ManageWhatsappController from '../../controllers/admin/ManageWhatsappController.js';

const router = Router();

const twilioAuthToken = process.env.AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;

// Use TWILIO_WEBHOOK_URL when behind ngrok so signature validation uses the same URL Twilio signed (e.g. https://xxx.ngrok-free.dev/api/twilio/webhook)
const webhookUrl = process.env.TWILIO_WEBHOOK_URL && process.env.TWILIO_WEBHOOK_URL.trim();

const validateTwilio = twilio.webhook(twilioAuthToken || '', {
    validate: !!twilioAuthToken,
    ...(webhookUrl && { url: webhookUrl })
});

// Inbound webhook from Twilio
router.post('/webhook', validateTwilio, ManageWhatsappController.twilioWebhook);

// Conversation history (all messages)
router.get('/conversation/:phone', ManageWhatsappController.getConversation);

// Session status for a phone
router.get('/session-status/:phone', ManageWhatsappController.getSessionStatus);

// Outbound send endpoint (mounted under /api/twilio and /api/whatsapp in index.js)
router.post('/send', ManageWhatsappController.sendMessage);

// Mark conversation as seen (called when CRM opens chat drawer)
router.post('/mark-seen', ManageWhatsappController.markSeen);

// Fetch only inbound (user reply) messages for a phone number
router.get('/:phone', ManageWhatsappController.getMessages);

export default router;
