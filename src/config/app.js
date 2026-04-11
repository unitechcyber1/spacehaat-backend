 const app = {
    host: process.env.HOST || '0.0.0.0',
    port: process.env.PORT || '8000',
    // port: process.env.PORT || '6000',
    name: process.env.NAME || 'spacehaat',
    secret: 'ANJPV4070F',
    encryptionKey: process.env.ENCRYPTION_KEY || '-JaNdRgUkXn2r5u8x/A?D(G+KbPeShVmYq3s6v9y$B&E)H@McQfTjWnZr4u7w!z%',
    superSecretForAdmin: process.env.JWT_SECRET_ADMIN || '_QNxOvsAiEWoMnSGuxs66uFDjIRiZSfdmQ',
    superSecretForUser: process.env.JWT_SECRET_USER || 'NakJ5JQHWaTnz3GiXQl0kVPjsFYzdI8ClA',
    adminEmail: process.env.ADMIN_EMAIL_ID || 'lead@cofynd.com',
    listingEmail: process.env.LISTING_EMAIL_ID || 'list@cofynd.com',
    base: process.env.BASE || 'http://0.0.0.0:6000',
    allowedExtensions: ['png', 'jpeg', 'jpg', 'pdf', 'xls', 'xlsx', 'svg', 'webp'],
    amadeusClientId: process.env.AMADEUS_CLIENT_ID || 'RA4Sfxcw9DWSSIVLEX09p6bt9QbtKBHL',
    amadeusClientSecret: process.env.AMADEUS_CLIENT_SECRET || 'ibhwQ4G5H4pY0vvy',
    amadeusGrantType: process.env.AMADEUS_GRANT_TYPE || 'client_credentials',
    defaultPhoneNumbers: process.env.DEFAULT_PHONE_NUMBERS || ['9582444989'],
    defaultOTP: process.env.DEFAULT_OTP || '9999',
    razerPay: {
        key: process.env.RAZER_PAY_KEY || 'rzp_live_1psf55EiMDZ4Vb',
        secret: process.env.RAZER_PAY_SECRET || 'ZDACumQb7eGBlpJrhBTZQB5d',
        webHookSecretKey: process.env.RAZER_PAY_WEB_HOOK_SECRET || 'rzp_live_COFYND_Zg93QZrTak'
    },
    messageService: {
        url: process.env.MESSAGE_SERVICE_URL || 'https://api.msg91.com/api',
        key: process.env.MESSAGE_SERVICE_TOKEN || '313377AuJNwa2WE5e1ffe33P1',
        templateId: process.env.MESSAGE_SERVICE_TEMPLATE_ID || '6267b6fa8fb1255d9e4db8a5'
    },
    // googleApiKey: process.env.GOOGLE_API_KEY || 'AIzaSyCJXuDpLPpp7Vf-b7zFORrC3Zm9SBz21PA',
    locationIqApiKey: process.env.LOCATIOIQMAP_API_KEY || 'pk.c0dc118d922d758a22955af83b95f5c4',
    leadSquaredUrl: process.env.LEAD_SQUARED_URL || 'https://api-in21.leadsquared.com/v2/',
    leadSquaredAccessToken: process.env.LEAD_SQUARED_ACCESS_KEY || 'u$r3c78a7f9a8a23207ec6958dc9d7578e5',
    leadSquaredSecretKey: process.env.LEAD_SQUARED_SECRET_KEY || '17bdb67e7acde8339362088bb36aa59264e0679d'
};

export default app;