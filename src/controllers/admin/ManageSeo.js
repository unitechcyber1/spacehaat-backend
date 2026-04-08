import manageSeoService from '../../services/admin/manage-seo.js';

class ManageRoom {
    constructor() {
        return {
            getSeos: this.getSeos.bind(this),
            getSeoById: this.getSeoById.bind(this),
            getSeoByPath: this.getSeoByPath.bind(this),
            addOrEditSeo: this.addOrEditSeo.bind(this),
            deleteSeo: this.deleteSeo.bind(this)
        }
    }

    async getSeos(req, res, next) {
        try {
            const data = await manageSeoService.getSeos(req.query);
            return res.status(200).json({
                message: 'Seo list',
                data: data.seos,
                totalRecords: data.count
            });
        } catch (error) {
            next(error)
        }
    }

    async getSeoById(req, res, next) {
        try {
            const seo = await manageSeoService.getSeoById(req.params);
            return res.status(200).json({
                message: 'Seo detail By Id',
                data: seo
            });
        } catch (error) {
            next(error)
        }
    }

    async getSeoByPath(req, res, next) {
        try {
            const seo = await manageSeoService.getSeoByPath(req.params);
            return res.status(200).json({
                message: 'Seo detail By Path',
                data: seo
            });
        } catch (error) {
            next(error);
        }
    }

    async addOrEditSeo(req, res, next) {
        try {
            let seo = null;
            let message = 'Seo Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body);
                seo = await manageSeoService.editSeo(forEdit);
                message = 'Seo Updated';
            } else {
                seo = await manageSeoService.addSeo(req.body);
            }
            res.status(200).json({
                message,
                data: seo
            });
        } catch (error) {
            next(error)
        }
    }

    async deleteSeo(req, res, next) {
        try {
            await manageSeoService.deleteSeo(req.params);
            res.status(200).json({
                message: 'Seo deleted'
            })
        } catch (error) {
            next(error);
        }
    }
}
export default new ManageRoom();
