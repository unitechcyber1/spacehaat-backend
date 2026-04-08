import manageReviewService from '../../services/user/manage-review.js';

class ManageReview {
    constructor() {
        return {
            getReviewBySpaceId: this.getReviewBySpaceId.bind(this),
            getSpaceReviewByUser: this.getSpaceReviewByUser.bind(this),
            getAverageReviewBySpace: this.getAverageReviewBySpace.bind(this),
            getColivingAverageReviewBySpace: this.getColivingAverageReviewBySpace.bind(this),
            createReview: this.createReview.bind(this),
            updateReview: this.updateReview.bind(this),
            deleteReview: this.deleteReview.bind(this),
        }
    }

    async getReviewBySpaceId(req, res, next) {
        try {
            const query = Object.assign(req.params, req.query);
            const result = await manageReviewService.getReviewBySpaceId(query);
            res.status(200).json({
                message: 'Get Reviews by Space',
                data: result.reviews,
                totalRecords: result.count
            })
        } catch (error) {
            next(error);
        }
    }

    async getSpaceReviewByUser(req, res, next) {
        try {
            const userReview = await manageReviewService.getSpaceReviewByUser(req.params);
            res.status(200).json({
                message: 'Get Space Reviews by User',
                data: userReview
            })
        } catch (error) {
            next(error);
        }
    }

    async getAverageReviewBySpace(req, res, next) {
        try {
            const review = await manageReviewService.getAverageReviewBySpace(req.params);
            res.status(200).json({
                message: 'Get coworking average review by Space',
                data: review || { average: 0 }
            });
        } catch (error) {
            next(error);
        }
    }
    async getColivingAverageReviewBySpace(req, res, next) {
        try {
            const review = await manageReviewService.getAverageReviewByColivingSpace(req.params);
            res.status(200).json({
                message: 'Get Coliving average review by Space',
                data: review || { average: 0 }
            });
        } catch (error) {
            next(error);
        }
    }

    async createReview(req, res, next) {
        try {
            const requestBody = Object.assign(req.body);
            const user = await manageReviewService.createReview(requestBody);
            res.status(200).json({
                message: 'create review',
                data: user
            })
        } catch (error) {
            next(error)
        }
    }

    async updateReview(req, res, next) {
        try {
            const requestBody = Object.assign(
                req.body,
                req.params,
                { user: req.user ? req.user.id : null }
            );
            await manageReviewService.updateReview(requestBody);
            res.status(200).json({
                message: 'update review',
                data: null
            })
        } catch (error) {
            next(error)
        }
    }

    async deleteReview(req, res, next) {
        try {
            await manageReviewService.deleteReview(req.params);
            res.status(200).json({
                message: 'delete review',
                data: null
            })
        } catch (error) {
            next(error)
        }
    }
}

export default new ManageReview();