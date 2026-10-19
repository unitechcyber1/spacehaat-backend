import manageNewSeoService from '../../services/admin/manage-new-seo.js';

class ManageNewSeo {
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
            const data = await manageNewSeoService.getSeos(req.query);
            return res.status(200).json({
                message: 'New Seo list',
                data: data.seos,
                totalRecords: data.count
            });
        } catch (error) {
            next(error)
        }
    }

    async getSeoById(req, res, next) {
        try {
            const seo = await manageNewSeoService.getSeoById(req.params);
            return res.status(200).json({
                message: 'New Seo detail By Id',
                data: seo
            });
        } catch (error) {
            next(error)
        }
    }

    async getSeoByPath(req, res, next) {
        try {
            const seo = await manageNewSeoService.getSeoByPath(req.params);
            return res.status(200).json({
                message: 'New Seo detail By Path',
                data: seo
            });
        } catch (error) {
            next(error);
        }
    }

    async addOrEditSeo(req, res, next) {
        try {
            let seo = null;
            let message = 'New Seo Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body);
                seo = await manageNewSeoService.editSeo(forEdit);
                message = 'New Seo Updated';
            } else {
                seo = await manageNewSeoService.addSeo(req.body);
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
            await manageNewSeoService.deleteSeo(req.params);
            res.status(200).json({
                message: 'New Seo deleted'
            })
        } catch (error) {
            next(error);
        }
    }
}
export default new ManageNewSeo();
