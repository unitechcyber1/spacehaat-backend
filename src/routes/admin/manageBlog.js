import { Router } from 'express';
const router = Router();
import manageBlog from '../../controllers/admin/ManageBlog.js';

router.get('/blogs', manageBlog.getBlogs)
    .get('/blog/:findKey', manageBlog.getBlogById)
    .post('/blog', manageBlog.addOrEditBlog)
    .put('/blog/:blogId', manageBlog.addOrEditBlog)
    .put('/blog/slug/update', manageBlog.changeSlugById)
    .post('/blog/changeStatus/:blogId', manageBlog.changeBlogStatus)
export default router;
