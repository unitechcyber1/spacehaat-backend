import manageCreditsTransaction from "../../services/admin/manage-credits-transaction.js";


class ManageCreditsTransaction {
    constructor() {
        return {
            getCreditsTransaction: this.getCreditsTransaction.bind(this),
            deleteOrder: this.deleteOrder.bind(this)
        }
    }

    async deleteOrder(req, res, next){
        try {
            await manageCreditsTransaction.deleteOrder(req.params);
             res.status(200).json({
                message: 'Credit order deleted successfully'
            })

        } catch (error) {
            next(error)
        }
    }
    async getCreditsTransaction(req, res, next) {
        try {
            const order = await manageCreditsTransaction.getCreditsTransaction(req.query);
            res.status(200).json({
                message: 'credit transactions',
                data: order.transactions,
                totalRecords: order.totalRecords
            })
        } catch (error) {
            next(error);
        }
    }

}

export default new ManageCreditsTransaction();