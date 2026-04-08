import { Router } from 'express';
const router = Router();
import manageBlog from '../../controllers/user/ManageBlog.js';

router.get('/blog', manageBlog.getBlogs)
    .get('/blog/news', manageBlog.getBlogNews)
    .get('/blog/:type/:findKey', manageBlog.getBlogById)
    .get('/blog/:findKey', manageBlog.getBlogById)
    .get('/blogByType/:type', manageBlog.getBlogsByType)

export default router;
