

import manageCreditUsage from "../../services/user/manage-creditUsage.js";
class ManageCreditUsage {

    constructor() {
        return {
            createCreditUsage: this.createCreditUsage.bind(this)
        }
    }

    async createCreditUsage(req, res, next) {
        try {
            const credits = await manageCreditUsage.createCreditUsage(req.body);
            res.status(200).json({
                message: 'credit usage created!',
                data: credits
            })
        } catch (error) {
            next(error);
        }
    }
}

export default new ManageCreditUsage;