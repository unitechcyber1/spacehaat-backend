import manageReviewService from '../../services/admin/manage-review.js';

class ManageReview {
    constructor() {
        return {
            getReviews: this.getReviews.bind(this),
            changeReviewStatus: this.changeReviewStatus.bind(this),
            getReviewById: this.getReviewById.bind(this),
        }
    }

    async getReviews(req, res, next) {
        try {
            const result = await manageReviewService.getReviews(req.query);
            res.status(200).json({
                message: 'Get Reviews',
                data: result.reviews,
                totalRecords: result.count
            })
        } catch (error) {
            next(error);
        }
    }

    async changeReviewStatus(req, res, next) {
        try {
            const request = Object.assign(req.body, req.params);
            const review = await manageReviewService.changeReviewStatus(request);
            res.status(200).json({
                message: 'change status',
                data: review
            });
        } catch (error) {
            next(error);
        }
    }

    async getReviewById(req, res, next) {
        try {
            const review = await manageReviewService.getReviewById(req.params);
            res.status(200).json({
                message: 'Get Review by id',
                data: review
            })
        } catch (error) {
            next(error);
        }
    }
}

export default new ManageReview();