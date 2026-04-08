import manageContactUsService from '../../services/admin/manage-contact-us.js';

class ManageContactUs {
    constructor() {
        return {
            createContactUs: this.createContactUs.bind(this),
            getContactUs: this.getContactUs.bind(this),
        }
    }

    async getContactUs(req, res, next) {
        try {
            const result = await manageContactUsService.getContactUs(req.params);
            res.status(200).json({
                message: 'get Contact Us list',
                data: result.contactUs,
                totalRecords: result.count
            })
        } catch (error) {
            next(error);
        }
    }

    async createContactUs(req, res, next) {
        try {
            const contactUs = await manageContactUsService.createContactUs(req.body);
            res.status(200).json({
                message: 'created ContactUs',
                data: contactUs
            })
        } catch (error) {
            next(error);
        }
    }
}

export default new ManageContactUs();