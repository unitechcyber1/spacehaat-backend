import manageEquipmentService from '../../services/admin/manage-equipment.js';

class ManageEquipment {
    constructor() {
        return {
            getEquipments: this.getEquipments.bind(this),
            addOrEditEquipment: this.addOrEditEquipment.bind(this),
            deleteEquipment: this.deleteEquipment.bind(this)
        }
    }

    async getEquipments(req, res, next) {
        try {
            const data = await manageEquipmentService.getEquipments(req.query);
            return res.status(200).json({
                message: 'Equipment list',
                data: data.equipments,
                totalRecords: data.count
            });
        } catch (error) {
            next(error)
        }
    }

    async addOrEditEquipment(req, res, next) {
        try {
            let amenty = null;
            let message = 'Equipment Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body);
                amenty = await manageEquipmentService.editEquipment(forEdit);
                message = 'Equipment Updated';
            } else {
                amenty = await manageEquipmentService.addEquipment(req.body);
            }
            res.status(200).json({
                message,
                data: amenty
            });
        } catch (error) {
            next(error)
        }
    }

    async deleteEquipment(req, res, next) {
        try {
            await manageEquipmentService.deleteEquipment(req.params);
            res.status(200).json({
                message: 'Amenty deleted'
            })
        } catch (error) {
            next(error);
        }
    }
}
export default new ManageEquipment();
