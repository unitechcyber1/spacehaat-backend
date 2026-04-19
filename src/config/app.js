import './loadEnv.js';

const app = {
    host: process.env.HOST || '0.0.0.0',
    port: process.env.PORT || '8000',
    // port: process.env.PORT || '6000',
    name: process.env.NAME || 'spacehaat',
    secret: 'ANJPV4070F',
    encryptionKey: process.env.ENCRYPTION_KEY,
    superSecretForAdmin: process.env.JWT_SECRET_ADMIN,
    superSecretForUser: process.env.JWT_SECRET_USER,
    adminEmail: process.env.ADMIN_EMAIL_ID,
    listingEmail: process.env.LISTING_EMAIL_ID,
    base: process.env.BASE,
    allowedExtensions: ['png', 'jpeg', 'jpg', 'pdf', 'xls', 'xlsx', 'svg', 'webp'],
    amadeusClientId: process.env.AMADEUS_CLIENT_ID,
    amadeusClientSecret: process.env.AMADEUS_CLIENT_SECRET,
    amadeusGrantType: process.env.AMADEUS_GRANT_TYPE,
    defaultPhoneNumbers: process.env.DEFAULT_PHONE_NUMBERS,
    defaultOTP: process.env.DEFAULT_OTP,
    razerPay: {
        key: process.env.RAZER_PAY_KEY,
        secret: process.env.RAZER_PAY_SECRET,
        webHookSecretKey: process.env.RAZER_PAY_WEB_HOOK_SECRET,
    },
    messageService: {
        url: process.env.MESSAGE_SERVICE_URL,
        key: process.env.MESSAGE_SERVICE_TOKEN,
        templateId: process.env.MESSAGE_SERVICE_TEMPLATE_ID,
    },
    locationIqApiKey: process.env.LOCATIOIQMAP_API_KEY,
    leadSquaredUrl: process.env.LEAD_SQUARED_URL,
    leadSquaredAccessToken: process.env.LEAD_SQUARED_ACCESS_KEY,
    leadSquaredSecretKey: process.env.LEAD_SQUARED_SECRET_KEY,
};

export default app;