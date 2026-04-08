import models from '../../models/index.js';
import twilio from 'twilio';
import { emitWhatsAppMessage } from '../../utilities/socket.js';

const WhatsAppMessage = models['WhatsAppMessage'];
const Enquiry = models['Enquiry'];
const WhatsappReadState = models['WhatsappReadState'];

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const accountSid = process.env.ACCOUNT_SID;
const authToken = process.env.AUTH_TOKEN;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+919311328047';
const fallbackTemplateSid = process.env.WHATSAPP_TEMPLATE_SID || 'HX876c42ce46abc287d3ef9805bf4e888e';

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

function normalizePhone(value) {
    if (!value || typeof value !== 'string') return '';
    // Strip whatsapp: prefix if present
    let phone = value.replace(/^whatsapp:/i, '').trim();
    // Remove spaces, hyphens, and parentheses
    phone = phone.replace(/[\s\-()]/g, '');
    return phone;
}

/**
 * Build possible phone formats as stored in Enquiry.other_info.phone_number
 * so we can match leads when Twilio sends normalized inbound number.
 */
function getPhoneVariantsForEnquiry(normalizedPhone) {
    if (!normalizedPhone) return [];
    const set = new Set([normalizedPhone]);
    // Without + prefix (e.g. 918650560791)
    if (normalizedPhone.startsWith('+')) {
        set.add(normalizedPhone.slice(1));
    } else {
        set.add('+' + normalizedPhone);
    }
    // Indian 10-digit (e.g. 8650560791)
    const digitsOnly = normalizedPhone.replace(/\D/g, '');
    if (digitsOnly.length >= 10) {
        set.add(digitsOnly.slice(-10));
        set.add('+91' + digitsOnly.slice(-10));
        set.add('+91-' + digitsOnly.slice(-10));
    }
    set.add(digitsOnly);
    return [...set].filter(Boolean);
}

class ManageWhatsappService {
    constructor() {
        return {
            handleInboundMessage: this.handleInboundMessage.bind(this),
            sendOutboundMessage: this.sendOutboundMessage.bind(this),
            getMessagesByPhone: this.getMessagesByPhone.bind(this),
            getConversationByPhone: this.getConversationByPhone.bind(this),
            getSessionStatus: this.getSessionStatus.bind(this),
            markSeen: this.markSeen.bind(this),
        };
    }

    /**
     * Fetch WhatsApp messages for a phone number.
     * By default returns only inbound (user replies), newest first.
     */
    async getMessagesByPhone({ phone, direction = 'inbound' }) {
        try {
            if (!phone) {
                return { messages: [], total: 0 };
            }
            const normalizedPhone = normalizePhone(phone);
            const candidates = [
                normalizedPhone,
                phone,
                `whatsapp:${normalizedPhone}`
            ].filter(Boolean);

            const query = { phone: { $in: candidates } };
            if (direction) {
                query.direction = direction;
            }
            const messages = await WhatsAppMessage.find(query)
                .sort({ createdAt: -1 })
                .lean();
            return {
                messages,
                total: messages.length
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Full conversation (inbound + outbound) ordered oldest → newest.
     */
    async getConversationByPhone({ phone }) {
        try {
            if (!phone) {
                return { messages: [], total: 0 };
            }
            const normalizedPhone = normalizePhone(phone);
            const candidates = [
                normalizedPhone,
                phone,
                `whatsapp:${normalizedPhone}`
            ].filter(Boolean);

            const messages = await WhatsAppMessage.find({ phone: { $in: candidates } })
                .sort({ createdAt: 1 })
                .lean();
            return {
                messages,
                total: messages.length
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Persist inbound WhatsApp message and update related lead session expiry.
     */
    async handleInboundMessage({ phone, message, messageSid, status }) {
        try {
            const normalizedPhone = normalizePhone(phone);
            console.log('Storing inbound WhatsApp message:', {
                rawPhone: phone,
                normalizedPhone,
                messageSid
            });

            const savedMessage = await WhatsAppMessage.create({
                phone: normalizedPhone,
                direction: 'inbound',
                message,
                messageSid,
                status
            });
            emitWhatsAppMessage(normalizedPhone, savedMessage);

            const expiry = new Date(Date.now() + TWENTY_FOUR_HOURS_MS);

            const phoneVariants = getPhoneVariantsForEnquiry(normalizedPhone);
            const updated = await Enquiry.updateMany(
                { 'other_info.phone_number': { $in: phoneVariants } },
                { $set: { whatsappSessionExpiry: expiry } }
            );
            if (updated.modifiedCount > 0) {
                console.log('WhatsApp session started for phone variants:', phoneVariants.slice(0, 3), 'expiry:', expiry.toISOString());
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Send an outbound WhatsApp message, using a normal session message
     * when whatsappSessionExpiry is still valid, otherwise an approved template.
     */
    async sendOutboundMessage({ phone, message }) {
        if (!client) {
            throw new Error('Twilio client is not configured. Please set ACCOUNT_SID and AUTH_TOKEN.');
        }

        const now = new Date();

        const normalizedPhone = normalizePhone(phone);
        const phoneVariants = getPhoneVariantsForEnquiry(normalizedPhone);

        const lead = await Enquiry.findOne({
            'other_info.phone_number': { $in: phoneVariants },
            space_type: 'Web Virtual Office'
        })
            .sort({ added_on: -1 })
            .lean();

        const expiryDate = lead?.whatsappSessionExpiry ? new Date(lead.whatsappSessionExpiry) : null;
        const inSession = !!(lead && expiryDate && expiryDate > now);
        console.log('WhatsApp lead lookup:', {
            phone,
            foundLead: !!lead,
            whatsappSessionExpiry: lead?.whatsappSessionExpiry || null,
            now
        });
        let response;
        let direction = 'outbound';

        try {
            if (inSession) {
                response = await client.messages.create({
                    from: twilioWhatsAppNumber,
                    to: `whatsapp:${normalizedPhone}`,
                    body: message
                });
            } else {
                if (!fallbackTemplateSid) {
                    throw new Error('WHATSAPP_TEMPLATE_SID is not configured for template messages.');
                }

                response = await client.messages.create({
                    from: twilioWhatsAppNumber,
                    contentSid: fallbackTemplateSid,
                    contentVariables: JSON.stringify({ 1: message }),
                    to: `whatsapp:${normalizedPhone}`
                });
            }

            const savedMessage = await WhatsAppMessage.create({
                phone: normalizedPhone,
                direction,
                message,
                messageSid: response.sid,
                status: response.status
            });
            emitWhatsAppMessage(normalizedPhone, savedMessage);

            console.log(`✅ WhatsApp ${inSession ? 'normal' : 'template'} message sent to ${normalizedPhone} (sid=${response.sid})`);

            return {
                mode: inSession ? 'normal' : 'template',
                status: response.status,
                sid: response.sid
            };
        } catch (error) {
            console.error(`❌ Failed to send WhatsApp message to ${phone}`, error);
            throw error;
        }
    }

    /**
     * Compute WhatsApp session status for a lead by phone.
     */
    async getSessionStatus({ phone }) {
        try {
            if (!phone) {
                return null;
            }

            const normalizedPhone = normalizePhone(phone);
            const phoneVariants = getPhoneVariantsForEnquiry(normalizedPhone);

            const lead = await Enquiry.findOne({
                'other_info.phone_number': { $in: phoneVariants },
                space_type: 'Web Virtual Office'
            }).lean();

            if (!lead || !lead.whatsappSessionExpiry) {
                return {
                    isWhatsAppInSession: false,
                    sessionExpiresInMinutes: 0
                };
            }

            const now = new Date();
            const expiryDate = new Date(lead.whatsappSessionExpiry);
            const isInSession = expiryDate > now;
            const timeLeftMs = isInSession ? (expiryDate.getTime() - now.getTime()) : 0;

            return {
                isWhatsAppInSession: isInSession,
                sessionExpiresInMinutes: Math.max(0, Math.floor(timeLeftMs / 60000))
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Mark WhatsApp conversation as seen for a phone.
     */
    async markSeen({ phone }) {
        const normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone) {
            return;
        }
        await WhatsappReadState.findOneAndUpdate(
            { phone: normalizedPhone },
            { $set: { lastSeenAt: new Date() } },
            { upsert: true, new: true }
        );
    }
}

export default new ManageWhatsappService();

