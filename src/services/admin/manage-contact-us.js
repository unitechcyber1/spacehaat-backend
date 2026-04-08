import models from '../../models/index.js';
const ContactUs = models['ContactUs'];

class ManageContactUsService {
    constructor() {
        return {
            createContactUs: this.createContactUs.bind(this),
            getContactUs: this.getContactUs.bind(this)
        }
    }

    async createContactUs({ name, phone_number, email, message, note }) {
        try {
            const contactUs = await ContactUs.create({ name, phone_number, email, message, note });
            return contactUs;
        } catch (error) {
            throw (error);
        }
    }

    async getContactUs({ limit, skip, orderBy = 1, sortBy = 'name' }) {
        try {
            const result = {};
            result.contactUs = await ContactUs.find({})
                .limit(limit)
                .skip(skip)
                .sort({ [sortBy]: orderBy });
            result.count = await ContactUs.countDocuments();
            return result;
        } catch (error) {
            throw (error);
        }
    }
}

export default new ManageContactUsService()