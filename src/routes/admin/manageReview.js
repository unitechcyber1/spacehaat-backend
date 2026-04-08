import { Router } from 'express';
const router = Router();
import manageReview from '../../controllers/admin/ManageReview.js';
import manageUserReview from '../../controllers/user/ManageReview.js';

router.get('/reviews', manageReview.getReviews)
    .get('/review/:reviewId', manageReview.getReviewById)
    .post('/review/changeStatus/:reviewId', manageReview.changeReviewStatus)
    .post('/create/review', manageUserReview.createReview)
    .put('/update/review/:reviewId', manageUserReview.updateReview)
    .delete('/delete/review/:reviewId', manageUserReview.deleteReview)


export default router;
