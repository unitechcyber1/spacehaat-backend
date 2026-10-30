import manageManagedOfficeService from '../../services/user/manage-managed-office.js';

class ManageManagedOffice {
    constructor() {
        return {
            getManagedOffices: this.getManagedOffices.bind(this),
            getManagedOfficeByIdOrSlug: this.getManagedOfficeByIdOrSlug.bind(this),
        };
    }

    async getManagedOffices(req, res, next) {
        try {
            const result = await manageManagedOfficeService.getManagedOffices(req.query);
            res.status(200).json({
                message: 'Managed office list',
                data: result.managedOffices,
                totalRecords: result.count,
            });
        } catch (error) {
            next(error);
        }
    }

    async getManagedOfficeByIdOrSlug(req, res, next) {
        try {
            const data = await manageManagedOfficeService.getManagedOfficeByIdOrSlug(req.params);
            res.status(200).json({
                message: 'Managed office detail',
                data,
            });
        } catch (error) {
            next(error);
        }
    }
}

export default new ManageManagedOffice();
