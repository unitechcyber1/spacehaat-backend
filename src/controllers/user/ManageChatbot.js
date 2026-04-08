import chatbotService from '../../services/user/manage-chatbot.js';

class ChatbotController {
    constructor() {
        return {
            startSession: this.startSession.bind(this),
            saveCity: this.saveCity.bind(this),
            saveLocation: this.saveLocation.bind(this),
            savePurpose: this.savePurpose.bind(this),
            saveCompanyType: this.saveCompanyType.bind(this),
            selectOption: this.selectOption.bind(this),
            getDocuments: this.getDocuments.bind(this),
            bookVirtualOffice: this.bookVirtualOffice.bind(this),
            escalateToSales: this.escalateToSales.bind(this),
            getSession: this.getSession.bind(this)
        };
    }

    async startSession(req, res, next) {
        try {
            const result = await chatbotService.startSession(req.body);
            res.status(200).json({
                message: 'Chatbot session started',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    async saveCity(req, res, next) {
        try {
            const result = await chatbotService.saveCity(req.body);
            res.status(200).json({
                message: 'City saved',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    async saveLocation(req, res, next) {
        try {
            const result = await chatbotService.saveLocation(req.body);
            res.status(200).json({
                message: 'Location saved',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    async savePurpose(req, res, next) {
        try {
            const result = await chatbotService.savePurpose(req.body);
            res.status(200).json({
                message: 'Purpose saved',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    async saveCompanyType(req, res, next) {
        try {
            const result = await chatbotService.saveCompanyType(req.body);
            res.status(200).json({
                message: 'Company type saved',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    async selectOption(req, res, next) {
        try {
            const result = await chatbotService.selectOption(req.body);
            res.status(200).json({
                message: 'Option selected',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    async getDocuments(req, res, next) {
        try {
            const result = await chatbotService.getDocuments(req.query);
            res.status(200).json({
                message: 'Required documents',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    async bookVirtualOffice(req, res, next) {
        try {
            const result = await chatbotService.bookVirtualOffice(req.body);
            res.status(200).json({
                message: 'Booking initiated',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    async escalateToSales(req, res, next) {
        try {
            const result = await chatbotService.escalateToSales(req.body);
            res.status(200).json({
                message: 'Escalated to sales',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    async getSession(req, res, next) {
        try {
            const result = await chatbotService.getSession(req.params);
            res.status(200).json({
                message: 'Chatbot session detail',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }
}

export default new ChatbotController();
