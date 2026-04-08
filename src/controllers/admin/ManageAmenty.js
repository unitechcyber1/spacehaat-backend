import manageAmentyService from '../../services/admin/manage-amenty.js';

class ManageAmenty {
    constructor() {
        return {
            getAmenties: this.getAmenties.bind(this),
            addOrEditAmenty: this.addOrEditAmenty.bind(this),
            deleteAmenty: this.deleteAmenty.bind(this),
            amentyOrderByDrag: this.amentyOrderByDrag.bind(this)
        }
    }

    async getAmenties(req, res, next) {
        try {
            const data = await manageAmentyService.getAmenties(req.query);
            return res.status(200).json({
                message: 'Amenty list',
                data: data.amenties,
                totalRecords: data.count
            });
        } catch (error) {
            next(error)
        }
    }

    async addOrEditAmenty(req, res, next) {
        try {
            let amenty = null;
            let message = 'Amenty Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body);
                amenty = await manageAmentyService.editAmenty(forEdit);
                message = 'Amenty Updated';
            } else {
                amenty = await manageAmentyService.addAmenty(req.body);
            }
            res.status(200).json({
                message,
                data: amenty
            });
        } catch (error) {
            next(error)
        }
    }
    async amentyOrderByDrag(req, res, next) {
        try {
            await manageAmentyService.amentyOrderByDrag(req.body);
            res.status(200).json({
                message: 'Set Priority amenity'
            })
        } catch (error) {
            next(error)
        }
    }

    async deleteAmenty(req, res, next) {
        try {
            await manageAmentyService.deleteAmenty(req.params);
            res.status(200).json({
                message: 'Amenty deleted'
            })
        } catch (error) {
            next(error);
        }
    }
}
export default new ManageAmenty();
