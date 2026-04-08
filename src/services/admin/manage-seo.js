import models from '../../models/index.js';
const Seo = models['Seo'];
class ManageSeoService {
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
            result.seos = await Seo.find(condition)
                .limit(limit)
                .skip(skip)
                .sort({ [sortBy]: orderBy });
            result.count = await Seo.countDocuments(condition);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async getSeoById({ seoId }) {
        try {
            return await Seo.findOne({ _id: seoId })
                .populate({ path: 'twitter.image', select: 'id s3_link' })
                .populate({ path: 'open_graph.image', select: 'id s3_link' });
        } catch (error) {
            throw (error);
        }
    }

    async getSeoByPath({ path }) {
        try {
            return await Seo.findOne({ path })
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
            return await Seo.create({
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
            return await Seo.findOneAndUpdate(
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
                this.updateOptions)
        } catch (e) {
            throw (e)
        }
    }

    async deleteSeo({ seoId }) {
        try {
            await Seo.deleteOne({ _id: seoId });
            return true;
        } catch (error) {
            throw (error)
        }
    }
}

export default new ManageSeoService();