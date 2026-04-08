import models from '../../models/index.js';

// Access the Blog model
const Blog = models['Blog'];

class ManageBlogService {
    constructor() {
        return {
            createBlog: this.createBlog.bind(this),
            updateBlog: this.updateBlog.bind(this),
            getBlogs: this.getBlogs.bind(this),
            getBlogById: this.getBlogById.bind(this),
            getBlogsByType: this.getBlogsByType.bind(this),
            changeSlugById: this.changeSlugById.bind(this),
            changeBlogStatus: this.changeBlogStatus.bind(this),
            getBlogNews: this.getBlogNews.bind(this),
        }
    }

    async createBlog({ heading, description, blog_type, cover_picture, seo, detail }) {
        try {
            const slug = await this._createSlug(null, heading);
            const blog = await Blog.create({
                slug,
                heading,
                description,
                seo,
                blog_type,
                cover_picture,
                detail
            });
            return blog;
        } catch (error) {
            throw (error);
        }
    }

    async updateBlog({ blogId, heading, description, blog_type, cover_picture, seo, detail }) {
        try {
            const slug = await this._createSlug(blogId, heading);
            return await Blog.findOneAndUpdate(
                { _id: blogId },
                { heading, description, blog_type, cover_picture, slug, seo, detail },
                { new: true });
        } catch (e) {
            throw (e)
        }
    }

    async getBlogById({ type: blog_type, findKey }) {
        try {
            let condition = {};
            if (blog_type) {
                condition['blog_type'] = blog_type === 'office-space' ? 'office' : blog_type;
            }
            if (findKey.match(/^[0-9a-fA-F]{24}$/)) {
                condition['_id'] = findKey; // Yes, it's a valid ObjectId, proceed with `findById` call.
            } else {
                condition['slug'] = findKey;
            }
            const blog = await Blog.findOne(condition)
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .populate('detail.news_image')
                .populate('cover_picture');
            return blog || this._throwException('blog not found');
        } catch (error) {
            throw (error);
        }
    }

    async getBlogs({ limit, skip, orderBy = -1, sortBy = 'created_by', name, blog_type, isUserCall = false }) {
        try {
            const result = {};
            let condition = {};
            if (isUserCall) {
                condition['status'] = 'approve';
            }
            if (name) {
                condition['heading'] = new RegExp(name, 'i');
            }
            if (blog_type) {
                condition['blog_type'] = blog_type;
            }
            result.blogs = await Blog.find(condition)
                .populate('detail.news_image')
                .populate('cover_picture')
                .limit(limit)
                .skip(skip)
                .sort({ _id: -1 });
            result.count = await Blog.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async getBlogNews({ limit, skip }) {
        try {
            const result = {};
            let condition = { 'detail.should_show_on_home': true, status: 'approve' };
            result.blogs = await Blog.find(condition, { detail: 1 })
                .populate('detail.news_image')
                .limit(limit)
                .skip(skip)
                .sort({ _id: -1 });
            result.count = await Blog.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async getBlogsByType({ limit, skip, orderBy = -1, sortBy = 'created_by', type = 'coworking' }) {
        try {
            const result = {};
            result.blogs = await Blog.find({ blog_type: type, status: 'approve' })
                .populate('detail.news_image')
                .populate('cover_picture')
                .limit(limit)
                .skip(skip)
                .sort({ [sortBy]: orderBy });
            result.count = await Blog.countDocuments({ blog_type: type });
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async _createSlug(id, name) {
        try {
            if (id) {
                const blog = await Blog.findOne({ _id: id });
                if (blog && blog.slug) {
                    return blog.slug;
                }
            }
            let slugName = `${name}`;
            slugName = slugName.toString().toLowerCase()
                .replace(/\s+/g, '-')        // Replace spaces with -
                .replace(/[^\w\-]+/g, '')   // Remove all non-word chars
                .replace(/\-\-+/g, '-')      // Replace multiple - with single -
                .replace(/^-+/, '')          // Trim - from start of text
                .replace(/-+$/, '');         // Trim - from end of text
            const blog = await Blog.findOne({ slug: slugName });
            if (blog) {
                slugName = blog.slug + '-' + crypto.randomBytes(2).toString('hex');
            }
            return slugName;
        } catch (error) {
            throw (error);
        }
    }

    async changeBlogStatus({ blogId, status }) {
        try {
            return await Blog.findOneAndUpdate({ _id: blogId }, { $set: { status } });
        } catch (error) {
            throw error;
        }
    }

    async changeSlugById({ id, slug }) {
        try {
            const blog = await Blog.findOne({ slug, _id: { $nin: [id] } });
            if (blog) {
                this._throwException('Opps! Slug is already used by another Blog');
            }
            await Blog.findOneAndUpdate({ _id: id }, { slug });
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

export default new ManageBlogService()