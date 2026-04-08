import axios from 'axios';
import config from '../config/index.js'
import twilio from 'twilio';
const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.AUTH_TOKEN;
const twilioWhatsAppNumber = 'whatsapp:+919311328047';
const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

function requireTwilioClient() {
    if (!client) {
        throw new Error('Twilio credentials missing. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
    }
    return client;
}
import models from '../models/index.js';
import aws from './aws.js';
import fs from 'fs';
import path from 'path';
const Enquiry = models['Enquiry'];
const FILE_PATH = path.join(
    process.cwd(),
    'virtual-office-whatsapp-sent.csv'
);
class MessageService {
    constructor() {
        this.axiosConfig = {
            headers: {
                'authkey': `${config.app.messageService.key}`,
                'Content-Type': 'application/json'
            }
        };
        return {
            sendSMS: this.sendSMS.bind(this),
            sendOTP: this.sendOTP.bind(this),
            verifyOTP: this.verifyOTP.bind(this),
            resendOTP: this.resendOTP.bind(this),
            sendWhatsAppMessage: this.sendWhatsAppMessage.bind(this),
            sendLeadsOnWhatsApp: this.sendLeadsOnWhatsApp.bind(this),
            sendWhatsAppMessageForListing: this.sendWhatsAppMessageForListing.bind(this),
            sendReminder: this.sendReminder.bind(this),
            sendReminderToCEO: this.sendReminderToCEO.bind(this),
            sendWhatsAppMessageForVirtual: this.sendWhatsAppMessageForVirtual.bind(this),
            sendOwnerContact: this.sendOwnerContact.bind(this),
            sendVirtualOfficeBulkEmails: this.sendVirtualOfficeBulkEmails.bind(this),
            sendVirtualOfficeBulkWhatsApp: this.sendVirtualOfficeBulkWhatsApp.bind(this),
            sendWhatsAppWelcomeForVirtual: this.sendWhatsAppWelcomeForVirtual.bind(this)
        }
    }

    async sendVirtualOfficeBulkEmails({
        limit = 200,
        delayMs = 2500
    } = {}) {
        console.log('📧 Virtual Office Email Job Started');

        try {
            // 1️⃣ Calculate last 3 months date
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

            // 2️⃣ Fetch eligible leads
            const leads = await Enquiry.find({
                space_type: 'Web Virtual Office',
                added_on: { $gte: threeMonthsAgo },
                isOtp: true,
                // email: { $exists: true, $ne: '' },
                'email.sent': { $ne: true },
                'email.unsubscribed': { $ne: true }
            })
                .limit(limit)
                .sort({ added_on: -1 });

            console.log(`📨 Found ${leads.length} leads to email`);

            if (!fs.existsSync(FILE_PATH)) {
                fs.writeFileSync(FILE_PATH, 'timestamp,name,email\n');
            }

            // Helper delay function
            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

            // 3️⃣ Send emails one by one
            for (const user of leads) {
                try {
                    const obj = {
                        toEmails: [user.other_info.email],
                        templateName: 'virtual_Office_followup', // your SES template
                        htmlVariables: {
                            name: user.other_info.name || 'there'
                        },
                        subjectVariables: {},
                        bccAddresses: [],
                        ccAddresses: []
                    };

                    await aws.sendMail(obj);

                    // 4️⃣ Mark email as sent
                    await Enquiry.updateOne(
                        { _id: user._id },
                        {
                            $set: {
                                'email.sent': true,
                                'email.sentAt': new Date()
                            }
                        }
                    );

                    const logLine = `${new Date().toISOString()},${user.other_info.name},${user.other_info.email}\n`;
                    fs.appendFileSync(FILE_PATH, logLine);

                    console.log(`✅ Email sent to ${user.other_info.email}`);

                    // // 5️⃣ Delay (SES-safe)
                    await delay(delayMs);

                } catch (err) {
                    console.error(
                        `❌ Failed to send email to ${user.other_info.email}`,
                        err.message
                    );
                }
            }

            console.log('🎉 Virtual Office Email Job Completed');

        } catch (error) {
            console.error('🔥 Bulk email job failed:', error);
            throw error;
        }
    }
    async sendVirtualOfficeBulkWhatsApp({
        limit = 200,
        delayMs = 2500
    } = {}) {
        console.log('📧 Virtual Office whatsapp Job Started');

        try {
            // 1️⃣ Calculate last 3 months date
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

            // 2️⃣ Fetch eligible leads
            const leads = await Enquiry.find({
                space_type: 'Web Virtual Office',
                added_on: { $gte: threeMonthsAgo },
                isOtp: true,
                'whatsapp.sent': { $ne: true },
                'whatsapp.unsubscribed': { $ne: true }
            })
                .limit(limit)
                .sort({ added_on: -1 });

            console.log(`📨 Found ${leads.length} leads to whatsapp`);

            if (!fs.existsSync(FILE_PATH)) {
                fs.writeFileSync(FILE_PATH, 'timestamp,name,email,phone\n');
            }

            // Helper delay function
            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

            // 3️⃣ Send emails one by one
            for (const user of leads) {
                try {
                    const response = await requireTwilioClient().messages.create({
                        contentSid: 'HX269f61d518060783151471f74aa878e2',
                        from: twilioWhatsAppNumber,
                        contentVariables: JSON.stringify({
                            1: user.other_info.name
                        }),
                        to: `whatsapp:${user.other_info.phone_number}`,
                    });

                    // 4️⃣ Mark email as sent
                    await Enquiry.updateOne(
                        { _id: user._id },
                        {
                            $set: {
                                'whatsapp.sent': true,
                                'whatsapp.sentAt': new Date()
                            }
                        }
                    );

                    const logLine = `${new Date().toISOString()},${user.other_info.name},${user.other_info.email},${user.other_info.phone_number}\n`;
                    fs.appendFileSync(FILE_PATH, logLine);

                    console.log(`✅ whatsapp sent to ${user.other_info.phone_number}`);

                    // // 5️⃣ Delay (SES-safe)
                    await delay(delayMs);

                } catch (err) {
                    console.error(
                        `❌ Failed to send whatsapp to ${user.other_info.phone_number}`,
                        err.message
                    );
                }
            }

            console.log('🎉 Virtual Office whatsapp Job Completed');

        } catch (error) {
            console.error('🔥 Bulk whatsapp job failed:', error);
            throw error;
        }
    }

    async sendSMS(data) {
        try {
            const body = this._sanitizeSmsBody(data);
            const result = await axios.post(
                `${config.app.messageService.url}/v2/sendsms`,
                body,
                this.axiosConfig
            );
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async sendOTP(mobile_number, otp, dial_code) {
        try {
            mobile_number = mobile_number.replace(/[^+\d]+/g, "");
            if (dial_code) {
                mobile_number = `${dial_code}${mobile_number}`;
            }
            const url = `${config.app.messageService.url}/v5/otp`;
            const result = await axios.get(url, {
                params: {
                    authkey: config.app.messageService.key,
                    template_id: config.app.messageService.templateId,
                    extra_param: { "OTP": otp, "COMPANY_NAME": "COFYND" },
                    mobile: mobile_number,
                    otp_expiry: 2
                },
            });
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async resendOTP(mobile_number) {
        try {
            mobile_number = mobile_number.replace(/[^+\d]+/g, "");
            const url = `${config.app.messageService.url}/v5/otp/retry?authkey=${config.app.messageService.key}&mobile=${mobile_number}&retrytype=text`;
            const result = await axios.post(url);
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async verifyOTP(mobile_number, otp) {
        try {
            mobile_number = mobile_number.replace(/[^+\d]+/g, "");
            const url = `${config.app.messageService.url}/v5/otp/verify?authkey=${config.app.messageService.key}&mobile=${mobile_number}&otp=${otp}`;
            const result = await axios.post(url);
            return result;
        } catch (error) {
            throw (error);
        }
    }
    async sendOwnerContact(to, templateParams) {
        try {
            const response = await requireTwilioClient().messages.create({
                contentSid: 'HX709fcef80a728831bd071b4cbb2852f1',
                from: twilioWhatsAppNumber,
                contentVariables: JSON.stringify({
                    1: templateParams[0],
                    2: templateParams[1],
                    3: templateParams[2],
                    4: templateParams[3],
                    5: templateParams[4]
                }),
                to: `whatsapp:${to}`,
            });
        } catch (error) {
            throw (error)
        }
    }
    async sendWhatsAppMessage(to, templateParams) {
        try {
            const response = await requireTwilioClient().messages.create({
                contentSid: 'HX3fbc99377c3bb2ee5316cc1a25107136',
                from: twilioWhatsAppNumber,
                contentVariables: JSON.stringify({
                    1: templateParams[0],
                    2: templateParams[1]
                }),
                to: `whatsapp:${to}`,
            });
        } catch (error) {
            console.error('Failed to send template message:', error.message);
        }
    }
    async sendWhatsAppMessageForVirtual(to, templateParams, sid) {
        try {
            const response = await requireTwilioClient().messages.create({
                contentSid: sid,
                from: twilioWhatsAppNumber,
                contentVariables: JSON.stringify({
                    1: templateParams[0] || 'There',
                    2: templateParams[1]
                }),
                to: `whatsapp:${to}`,
            });
        } catch (error) {
            console.error('Failed to send template message:', error.message);
        }
    }
    async sendWhatsAppWelcomeForVirtual(to, templateParams, sid) {
        try {
            await requireTwilioClient().messages.create({
                contentSid: sid,
                from: twilioWhatsAppNumber,
                contentVariables: JSON.stringify({
                    name: templateParams[0] || 'There',
                }),
                to: `whatsapp:${to}`,
            });
        } catch (error) {
            console.error('Failed to send template message:', error.message);
        }
    }
    async sendWhatsAppMessageForListing(to, templateParams) {
        try {
            const response = await requireTwilioClient().messages.create({
                contentSid: 'HXdd6c398e0c2a71b3040c7b92e377e57d',
                from: twilioWhatsAppNumber,
                contentVariables: JSON.stringify({
                    1: templateParams[0]
                }),
                to: `whatsapp:${to}`,
            });
        } catch (error) {
            console.error('Failed to send template message:', error.message);
        }
    }
    async sendLeadsOnWhatsApp(to, templateParams) {
        try {
            const response = await requireTwilioClient().messages.create({
                contentSid: 'HXd7f4a4988621e708006220d170b11ee1',
                from: twilioWhatsAppNumber,
                contentVariables: JSON.stringify({
                    1: templateParams[0] || 'Unknown',
                    2: templateParams[1] || 'No Contact',
                    3: templateParams[2] || 'No Email',
                    4: templateParams[3] || 'No Seats',
                    5: templateParams[4] || 'No Space',
                    6: templateParams[5] || 'No City',
                    7: templateParams[6] || 'No Location',
                    8: templateParams[7] || 'No Adress',
                    9: templateParams[8] || 'No Url',
                }),
                to: `whatsapp:${to}`,
            });
        } catch (error) {
            console.error('Failed to send template message:', error.message);
        }
    }
    async sendReminder(to, templateParams) {
        try {
            const response = await requireTwilioClient().messages.create({
                contentSid: 'HXab1c31a69d191ed00088a9f80715d686',
                from: twilioWhatsAppNumber,
                contentVariables: JSON.stringify({
                    1: templateParams[0] || '1',
                    2: templateParams[1] || 'Unknown',
                    3: templateParams[2] || 'No Contact',
                    4: templateParams[3] || 'No Email',
                    5: templateParams[4] || 'No Seats',
                    6: templateParams[5] || 'No Space',
                    7: templateParams[6] || 'No City',
                    8: templateParams[7] || 'No Location',
                    9: templateParams[8] || 'No Url',
                }),
                to: `whatsapp:${to}`,
            });
        } catch (error) {
            console.error('Failed to send template message:', error.message);
        }
    }
    async sendReminderToCEO(to, templateParams) {
        try {
            const response = await requireTwilioClient().messages.create({
                contentSid: 'HX0daddea252bac042517bb3eea0b0965c',
                from: twilioWhatsAppNumber,
                contentVariables: JSON.stringify({
                    1: templateParams[0] || 'Unknown',
                    2: templateParams[1] || 'No Contact',
                    3: templateParams[2] || 'No Email',
                    4: templateParams[3] || 'No Seats',
                    5: templateParams[4] || 'No Space',
                    6: templateParams[5] || 'No City',
                    7: templateParams[6] || 'No Location',
                    8: templateParams[7] || 'No Url',
                }),
                to: `whatsapp:${to}`,
            });
        } catch (error) {
            console.error('Failed to send template message:', error.message);
        }
    }

    _sanitizeSmsBody(sms) {
        return {
            "sender": "SOCKET",
            "route": "4",
            "country": "91",
            /** TODO will make it dynamic for all countries if requires*/
            "unicode": "1",
            "sms": [sms]
        }
    }
}

export default new MessageService();