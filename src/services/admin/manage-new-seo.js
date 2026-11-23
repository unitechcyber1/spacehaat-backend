import models from '../../models/index.js';
import { refreshWebsitePages } from '../../utilities/website-cache-refresh.js';
const NewSeo = models['NewSeo'];
class ManageNewSeoService {
    constructor() {
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };
        return {
            getSeos: this.getSeos.bind(this),
            getSeoById: this.getSeoById.bind(this),
            addSeo: this.addSeo.bind(this),
            editSeo: this.editSeo.bind(this),
            deleteSeo: this.deleteSeo.bind(this),
            getSeoByPath: this.getSeoByPath.bind(this),
        }
    }

    async getSeos({ limit = 10, sortBy = 'name', orderBy = 1, skip, name }) {
        try {
            let result = {};
            let condition = {};
            if (name) {
                name = '.*' + name + '.*';
                condition['path'] = { $regex: new RegExp('^' + name + '$', 'i') };
            }
            result.seos = await NewSeo.find(condition)
                .limit(limit)
                .skip(skip)
                .sort({ [sortBy]: orderBy });
            result.count = await NewSeo.countDocuments(condition);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async getSeoById({ seoId }) {
        try {
            return await NewSeo.findOne({ _id: seoId })
                .populate({ path: 'twitter.image', select: 'id s3_link' })
                .populate({ path: 'open_graph.image', select: 'id s3_link' });
        } catch (error) {
            throw (error);
        }
    }

    async getSeoByPath({ path }) {
        try {
            return await NewSeo.findOne({ path })
                .populate({ path: 'twitter.image', select: 'id s3_link' })
                .populate({ path: 'open_graph.image', select: 'id s3_link' });
        } catch (error) {
            throw (error);
        }
    }

    async addSeo({
        title,
        page_title,
        script,
        description,
        robots,
        keywords,
        url,
        status,
        faqs,
        path,
        footer_title,
        footer_description,
        twitter,
        open_graph,
        reviews
    }) {
        try {
            const created = await NewSeo.create({
                title,
                page_title,
                script,
                description,
                robots,
                keywords,
                url,
                status,
                faqs,
                path,
                footer_title,
                footer_description,
                twitter,
                open_graph,
                reviews
            });
            // Show the new text on the website at once instead of after its page cache expires.
            refreshWebsitePages(created?.path);
            return created;
        } catch (error) {
            throw error;
        }
    }

    async editSeo({
        seoId,
        title,
        page_title,
        script,
        description,
        robots,
        keywords,
        url,
        status,
        faqs,
        path,
        footer_title,
        footer_description,
        twitter,
        open_graph,
        reviews
    }) {
        try {
            const updated = await NewSeo.findOneAndUpdate(
                { _id: seoId },
                {
                    title,
                    page_title,
                    script,
                    description,
                    robots,
                    keywords,
                    url,
                    status,
                    faqs,
                    path,
                    footer_title,
                    footer_description,
                    twitter,
                    open_graph,
                    reviews
                },
                this.updateOptions);
            refreshWebsitePages(updated?.path);
            return updated;
        } catch (e) {
            throw (e)
        }
    }

    async deleteSeo({ seoId }) {
        try {
            await NewSeo.deleteOne({ _id: seoId });
            return true;
        } catch (error) {
            throw (error)
        }
    }
}

export default new ManageNewSeoService();