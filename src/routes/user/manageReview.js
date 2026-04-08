import { Router } from 'express';
const router = Router();
import manageReview from '../../controllers/user/ManageReview.js';

router.get('/spaceReviews/:spaceId', manageReview.getReviewBySpaceId)
    .get('/spaceAverageReview/:spaceId', manageReview.getAverageReviewBySpace)
    .get('/ColivingspaceAverageReview/:spaceId', manageReview.getColivingAverageReviewBySpace)
    .get('/spaceReviews/:space/user/:user', manageReview.getSpaceReviewByUser)
    .post('/review', manageReview.createReview)
    .put('/review/:reviewId', manageReview.updateReview)
    .delete('/review/:reviewId', manageReview.deleteReview)

export default router;
