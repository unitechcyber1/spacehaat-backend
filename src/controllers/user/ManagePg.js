import managePgService from '../../services/user/manage-pg.js';

class ManagePg {
    constructor() {
        return {
            getPgs: this.getPgs.bind(this),
            getPgByIdOrSlug: this.getPgByIdOrSlug.bind(this),
        };
    }

    async getPgs(req, res, next) {
        try {
            const result = await managePgService.getPgs(req.query);
            res.status(200).json({
                message: 'PG list',
                data: result.pgs,
                totalRecords: result.count,
            });
        } catch (error) {
            next(error);
        }
    }

    async getPgByIdOrSlug(req, res, next) {
        try {
            const result = await managePgService.getPgByIdOrSlug(req.params);
            res.status(200).json({
                message: 'PG detail',
                id: result.id,
                slug: result.slug,
                data: result.pg,
            });
        } catch (error) {
            next(error);
        }
    }
}

export default new ManagePg();
