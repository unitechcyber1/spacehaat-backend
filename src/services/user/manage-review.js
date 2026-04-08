import models from '../../models/index.js';
import manageWorkSpaceService from './manage-work-space.js';
import manageCoLivingSpaceService from './manage-co-living-space.js';
const Review = models['Review'];
class ManageReviewService {
    constructor() {
        return {
            getReviewBySpaceId: this.getReviewBySpaceId.bind(this),
            getSpaceReviewByUser: this.getSpaceReviewByUser.bind(this),
            getAverageReviewBySpace: this.getAverageReviewBySpace.bind(this),
            getAverageReviewByColivingSpace: this.getAverageReviewByColivingSpace.bind(this),
            createReview: this.createReview.bind(this),
            updateReview: this.updateReview.bind(this),
            deleteReview: this.deleteReview.bind(this),
        }
    }

    async getReviewBySpaceId({ limit, skip, orderBy = 1, sortBy = 'created_by', spaceId }) {
        try {
            const { id } = await manageWorkSpaceService.getWorkSpaceById({ findKey: spaceId });

            const condition = { is_active: true, space: id };
            condition['$or'] = [{ status: 'approve' }, { status: 'in-review' }]
            const result = {};
            result.reviews = await Review.find(condition)
                .populate('user')
                .populate('space')
                .limit(limit)
                .skip(skip)
                .sort({
                    [sortBy]: orderBy
                });
            result.count = await Review.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async getSpaceReviewByUser({ space, user }) {
        try {
            const condition = { is_active: true, space, user };
            return await Review.findOne(condition)
                .populate('user')
                .populate('space')
        } catch (error) {
            throw (error);
        }
    }

    async getAverageReviewBySpace({ spaceId }) {
        try {
            const { id } = await manageWorkSpaceService.getWorkSpaceById({ findKey: spaceId });
            const averageReviews = await Review.aggregate([{
                    $match: {
                        $or: [{ status: 'approve' }, { status: 'in-review' }],
                        is_active: true
                    }
                },
                { $group: { _id: '$space', average: { $avg: '$rating' } } }
            ]);
            return averageReviews.filter(element => {
                return element._id.toString() === id.toString();
            }).shift();
        } catch (error) {
            throw (error);
        }
    }
    async getAverageReviewByColivingSpace({ spaceId }) {
        try {
            const { id } = await manageCoLivingSpaceService.getCoLivingSpaceById({ findKey: spaceId });
            const averageReviews = await Review.aggregate([{
                    $match: {
                        $or: [{ status: 'approve' }, { status: 'in-review' }],
                        is_active: true
                    }
                },
                { $group: { _id: '$space', average: { $avg: '$rating' } } }
            ]);
            return averageReviews.filter(element => {
                return element._id.toString() === id.toString();
            }).shift();
        } catch (error) {
            throw (error);
        }
    }

    async createReview({ description, rating, user, space, on_model, user_by_admin, space_type }) {
        try {

            const review = await Review.create({ description, rating, user, space, on_model, user_by_admin, space_type });
            await Review.populate(review, { path: 'user' });
            await Review.populate(review, { path: 'space' });
            return review;
        } catch (error) {
            throw (error);
        }
    }

    async updateReview({ reviewId, description, rating, user, space, on_model, user_by_admin, space_type }) {
        try {
            // const review = await Review.findOne({ _id: reviewId, status: 'approve' });
            // if (!review) {
            //     this._throwException('Opps! Your previous Review is already in Admin Approval')
            // }
            // const review_history = {
            //     rating: review.rating,
            //     description: review.description
            // }
            return await Review.findOneAndUpdate({ _id: reviewId }, { description, rating, user, space, on_model, user_by_admin, space_type, status: 'in-review' }, { new: true });
        } catch (e) {
            throw (e)
        }
    }

    async deleteReview({ reviewId }) {
        try {
            await Review.findOneAndUpdate({ _id: reviewId }, { $set: { is_active: false } });
            return true;
        } catch (error) {
            throw (error);
        }
    }

    _throwException(message) {
        throw ({
            name: "cofynd",
            code: 404,
            message
        });
    }
}

export default new ManageReviewService()