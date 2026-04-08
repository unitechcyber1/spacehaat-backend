
import models from '../../models/index.js';
import messageService from '../../utilities/messageService.js';
const CreditUsage = models['CreditUsage'];
const CoLivingSpace = models['CoLivingSpace'];
const CreditTransaction = models['CreditTransaction'];

class ManageCreditUsage {

    constructor() {
        return {
            createCreditUsage: this.createCreditUsage.bind(this)
        }
    }

    async createCreditUsage({ property, user, type }) {
        try {
            const credits = await CreditUsage.create({ property, user, type });
            if (type === 'purchased') {
                const lastTransaction = await CreditTransaction.findOne({ user: user })
                    .sort({ added_on: -1 }).populate('user', 'name phone_number');
                // Fetch property owner details
                const space = await CoLivingSpace.findById(property); // assuming you have owner ref
                // If plan is 149 or 199 → send WhatsApp
                if ([149, 199].includes(lastTransaction?.amount)) {
                    messageService.sendOwnerContact(`+91${lastTransaction.user.phone_number}`, [lastTransaction.user.name, space?.name, space?.location?.address, space?.space_contact_details?.phone, space?.name]);
                }
            }

            return credits;
        } catch (error) {
            throw (error)
        }
    }
}

export default new ManageCreditUsage;