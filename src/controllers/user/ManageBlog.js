import manageBlogService from '../../services/admin/manage-blog.js';

class ManageBlog {
    constructor() {
        return {
            getBlogs: this.getBlogs.bind(this),
            getBlogNews: this.getBlogNews.bind(this),
            getBlogById: this.getBlogById.bind(this),
            getBlogsByType: this.getBlogsByType.bind(this)
        }
    }

    async getBlogs(req, res, next) {
        try {
            const query = Object.assign({ isUserCall: true }, req.query);
            const result = await manageBlogService.getBlogs(query);
            res.status(200).json({
                message: 'Get Blog list',
                data: result.blogs,
                totalRecords: result.count
            })
        } catch (error) {
            next(error);
        }
    }

    async getBlogNews(req, res, next) {
        try {
            const query = Object.assign({ isUserCall: true }, req.query);
            const result = await manageBlogService.getBlogNews(query);
            res.status(200).json({
                message: 'Get Blog News',
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

    async getBlogsByType(req, res, next) {
        try {
            const result = await manageBlogService.getBlogsByType(req.params);
            res.status(200).json({
                message: 'Get Blogs by Type',
                data: result.blogs,
                totalRecords: result.count
            })
        } catch (error) {
            next(error)
        }
    }

}

export default new ManageBlog();