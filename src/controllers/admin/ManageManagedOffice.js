import manageManagedOfficeService from '../../services/admin/manage-managed-office.js';

class ManageManagedOffice {
    constructor() {
        return {
            getManagedOffices: this.getManagedOffices.bind(this),
            getManagedOfficeById: this.getManagedOfficeById.bind(this),
            createOrUpdateManagedOffice: this.createOrUpdateManagedOffice.bind(this),
            changeManagedOfficeStatus: this.changeManagedOfficeStatus.bind(this),
            deleteManagedOffice: this.deleteManagedOffice.bind(this),
            changeSlugById: this.changeSlugById.bind(this),
            getManagedOfficeBrands: this.getManagedOfficeBrands.bind(this),
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

    async getManagedOfficeById(req, res, next) {
        try {
            const data = await manageManagedOfficeService.getManagedOfficeById(req.params);
            res.status(200).json({ message: 'Managed office detail', data });
        } catch (error) {
            next(error);
        }
    }

    async createOrUpdateManagedOffice(req, res, next) {
        try {
            let data;
            let message = 'Managed office created';
            if (req.method === 'PUT') {
                data = await manageManagedOfficeService.updateManagedOffice({ ...req.body, id: req.params.id });
                message = 'Managed office updated';
            } else {
                data = await manageManagedOfficeService.createManagedOffice(req.body);
            }
            res.status(200).json({ message, data });
        } catch (error) {
            next(error);
        }
    }

    async changeManagedOfficeStatus(req, res, next) {
        try {
            const data = await manageManagedOfficeService.changeManagedOfficeStatus({
                managedOfficeId: req.params.managedOfficeId,
                status: req.body?.status,
            });
            res.status(200).json({ message: 'Managed office status updated', data });
        } catch (error) {
            next(error);
        }
    }

    async deleteManagedOffice(req, res, next) {
        try {
            const data = await manageManagedOfficeService.deleteManagedOffice(req.params);
            res.status(200).json({ message: 'Managed office deleted', data });
        } catch (error) {
            next(error);
        }
    }

    async changeSlugById(req, res, next) {
        try {
            const data = await manageManagedOfficeService.changeSlug(req.body);
            res.status(200).json({ message: 'Slug updated', data });
        } catch (error) {
            next(error);
        }
    }

    async getManagedOfficeBrands(req, res, next) {
        try {
            const data = await manageManagedOfficeService.getManagedOfficeBrands();
            res.status(200).json({ message: 'Managed office brands', data });
        } catch (error) {
            next(error);
        }
    }
}

export default new ManageManagedOffice();
