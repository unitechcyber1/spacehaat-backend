import { Router } from 'express';
const router = Router();

import chatbotController from '../../controllers/user/ManageChatbot.js';

router
    .post('/chatbot/start', chatbotController.startSession)
    .post('/chatbot/city', chatbotController.saveCity)
    .post('/chatbot/location', chatbotController.saveLocation)
    .post('/chatbot/purpose', chatbotController.savePurpose)
    .post('/chatbot/company-type', chatbotController.saveCompanyType)
    .post('/chatbot/select-option', chatbotController.selectOption)
    .get('/chatbot/documents', chatbotController.getDocuments)
    .post('/chatbot/book', chatbotController.bookVirtualOffice)
    .post('/chatbot/escalate', chatbotController.escalateToSales)
    .get('/chatbot/session/:session_id', chatbotController.getSession);

export default router;
