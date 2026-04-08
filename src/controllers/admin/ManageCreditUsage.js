

import manageCreditUsage from "../../services/admin/manage-creditUsage.js";
class ManageCreditUsage {

    constructor() {
        return {
            getCreditUsage: this.getCreditUsage.bind(this)
        }
    }

    async getCreditUsage(req, res, next) {
        try {
            const results = await manageCreditUsage.getCreditUsage(req.query);
            res.status(200).json({
                message: 'Usage Credits!',
                data: results.data,
                totalCount: results.totalCount
            })
        } catch (error) {
            next(error);
        }
    }
}

export default new ManageCreditUsage;