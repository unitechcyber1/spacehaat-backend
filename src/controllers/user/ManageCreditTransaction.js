import manageCreditsTransaction from "../../services/user/manage-credits-transaction.js";


class ManageCreditsTransaction {
    constructor() {
        return {
            createCreditsTransaction: this.createCreditsTransaction.bind(this),
            capturedPayment: this.capturedPayment.bind(this)
        }
    }
    async createCreditsTransaction(req, res, next) {
        try {
            const order = await manageCreditsTransaction.createCreditsTransaction(req.body, req.user);
            res.status(200).json({
                message: 'order Id',
                data: order
            })
        } catch (error) {
            next(error);
        }
    }

        async capturedPayment(req, res, next) {
            try {
                const payment = await manageCreditsTransaction.capturedPayment(req.body);
                res.status(200).json({
                    message: 'payment captured',
                    data: payment
                })
            } catch (error) {
                next(error);
            }
        }

}

export default new ManageCreditsTransaction();