import models from '../../models/index.js';
const Review = models['Review'];

class ManageReviewService {
    constructor() {
        return {
            getReviews: this.getReviews.bind(this),
            changeReviewStatus: this.changeReviewStatus.bind(this),
            getReviewById: this.getReviewById.bind(this),
        }
    }

    async getReviews({ limit, skip, sortBy = 'added_on' }) {
        try {
            const result = {};
            result.reviews = await Review.find()
                .populate('user')
                .populate('space')
                .limit(limit)
                .skip(skip)
                .sort({ [sortBy]: -1 });
            result.count = await Review.countDocuments();
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async changeReviewStatus({ reviewId, status }) {
        try {
            return await Review.findOneAndUpdate({ _id: reviewId }, { $set: { status } });
        } catch (error) {
            throw error;
        }
    }

    async getReviewById({ reviewId }) {
        try {
            return await Review.findOne({ _id: reviewId })
                .populate('user')
                .populate('space')
                
        } catch (error) {
            throw error;
        }
    }

}

export default new ManageReviewService()