import manageEnquiryService from '../../services/user/manage-enquiry.js';

class ManageEnquiry {
    constructor() {
        return {
            createEnquiry: this.createEnquiry.bind(this),
            enquiryWithoutLogin: this.enquiryWithoutLogin.bind(this),
            getEnquiriesByUser: this.getEnquiriesByUser.bind(this),
            createLead: this.createLead.bind(this)
        }
    }

    async createEnquiry(req, res, next) {
        try {
            const object = Object.assign(req.body, req.user);
            const enquiry = await manageEnquiryService.createEnquiry(object);
            res.status(200).json({
                message: 'Enquiry created',
                data: enquiry
            })
        } catch (error) {
            next(error);
        }
    }

    async enquiryWithoutLogin(req, res, next) {
        try {
            const object = Object.assign(req.body);
            const enquiry = await manageEnquiryService.enquiryWithoutLogin(object);
            res.status(200).json({
                message: 'Enquiry created without login',
                data: enquiry
            })
        } catch (error) {
            next(error);
        }
    }

    async getEnquiriesByUser(req, res, next) {
        try {
            const result = await manageEnquiryService.getEnquiriesByUser(req.query, req.user);
            res.status(200).json({
                message: 'get Enquiry list',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async createLead(req, res, next) {
        try {
            const object = Object.assign(req.body, req.user);
            const result = await manageEnquiryService.createLead(object);
            res.status(200).json({
                message: 'create Lead',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }
}

export default new ManageEnquiry();