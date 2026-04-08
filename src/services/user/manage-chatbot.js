import models from '../../models/index.js';

const ChatbotSession = models['ChatbotSession'];

class ChatbotService {
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

    async startSession({ session_id, mobile, email, source, platform }) {
        if (!session_id || !mobile) {
            this._throwException('Session ID and mobile are required');
        }

        let session = await ChatbotSession.findOne({ session_id });

        if (!session) {
            session = await ChatbotSession.create({
                session_id,
                source,
                platform,
                user: { mobile, email },
                status: { current_step: 'CITY' }
            });
        }

        return { next_step: 'CITY' };
    }

    async saveCity({ session_id, city }) {
        await ChatbotSession.updateOne(
            { session_id },
            { $set: { 'flow.city': city, 'status.current_step': 'LOCATION' } }
        );
        return { next_step: 'LOCATION' };
    }

    async saveLocation({ session_id, location_preference }) {
        await ChatbotSession.updateOne(
            { session_id },
            { $set: { 'flow.location_preference': location_preference, 'status.current_step': 'PURPOSE' } }
        );
        return { next_step: 'PURPOSE' };
    }

    async savePurpose({ session_id, purpose }) {
        await ChatbotSession.updateOne(
            { session_id },
            { $set: { 'flow.purpose': purpose, 'status.current_step': 'COMPANY_TYPE' } }
        );
        return { next_step: 'COMPANY_TYPE' };
    }

    async saveCompanyType({ session_id, company_type }) {
        const recommended_options = [
            {
                location: 'Golf Course Road, Gurgaon',
                city: 'Gurgaon',
                price: 15000,
                gst_applicable: true,
                turnaround_time: '24-48 hrs'
            },
            {
                location: 'Sohna Road, Gurgaon',
                city: 'Gurgaon',
                price: 12000,
                gst_applicable: true,
                turnaround_time: '2-3 days'
            }
        ];

        await ChatbotSession.updateOne(
            { session_id },
            {
                $set: {
                    'flow.company_type': company_type,
                    recommended_options,
                    'status.current_step': 'OPTIONS_SHOWN'
                }
            }
        );

        return {
            next_step: 'OPTIONS_SHOWN',
            options: recommended_options
        };
    }

    async selectOption({ session_id, selected_option }) {
        await ChatbotSession.updateOne(
            { session_id },
            { $set: { selected_option, 'status.current_step': 'DOCUMENTS' } }
        );
        return { next_step: 'DOCUMENTS' };
    }

    async getDocuments({ session_id }) {
        return {
            company: ['PAN Card', 'Incorporation Certificate'],
            authorized_signatory: ['PAN Card', 'Aadhaar Card']
        };
    }

    async bookVirtualOffice({ session_id }) {
        await ChatbotSession.updateOne(
            { session_id },
            {
                $set: {
                    'status.booked': true,
                    'status.completed': true,
                    'status.current_step': 'COMPLETED',
                    'timestamps.completed_at': new Date()
                }
            }
        );
        return { booking_id: `VO_${Date.now()}` };
    }

    async escalateToSales({ session_id }) {
        await ChatbotSession.updateOne(
            { session_id },
            { $set: { 'status.escalated_to_sales': true } }
        );
        return true;
    }

    async getSession({ session_id }) {
        const session = await ChatbotSession.findOne({ session_id });
        if (!session) {
            this._throwException('Chatbot session not found');
        }
        return session;
    }

    _throwException(message) {
        throw ({
            name: 'cofynd',
            code: 400,
            message
        });
    }
}

export default new ChatbotService();
