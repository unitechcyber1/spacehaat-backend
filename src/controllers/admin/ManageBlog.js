import manageBlogService from '../../services/admin/manage-blog.js';

class ManageBlog {
    constructor() {
        return {
            addOrEditBlog: this.addOrEditBlog.bind(this),
            getBlogs: this.getBlogs.bind(this),
            getBlogById: this.getBlogById.bind(this),
            changeSlugById: this.changeSlugById.bind(this),
            changeBlogStatus: this.changeBlogStatus.bind(this),
        }
    }

    async getBlogs(req, res, next) {
        try {
            const result = await manageBlogService.getBlogs(req.query);
            res.status(200).json({
                message: 'Get Blog list',
                data: result.blogs,
                totalRecords: result.count
            })
        } catch (error) {
            next(error);
        }
    }

    async getBlogById(req, res, next) {
        try {
            const blog = await manageBlogService.getBlogById(req.params);
            res.status(200).json({
                message: 'Get Blog by id',
                data: blog
            })
        } catch (error) {
            next(error);
        }
    }

    async addOrEditBlog(req, res, next) {
        try {
            let blog = null;
            let message = 'Blog Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body);
                blog = await manageBlogService.updateBlog(forEdit);
                message = 'Blog Updated';
            } else {
                blog = await manageBlogService.createBlog(req.body);
            }
            res.status(200).json({
                message,
                data: blog
            });
        } catch (error) {
            next(error)
        }
    }

    async changeBlogStatus(req, res, next) {
        try {
            const reqObject = Object.assign({}, req.params, req.body);
            await manageBlogService.changeBlogStatus(reqObject);
            res.status(200).json({
                message: 'blog status updated'
            })
        } catch (error) {
            next(error)
        }
    }

    async changeSlugById(req, res, next) {
        try {
            await manageBlogService.changeSlugById(req.body);
            res.status(200).json({
                message: 'slug updated successfully'
            })
        } catch (error) {
            next(error);
        }
    }

}

export default new ManageBlog();