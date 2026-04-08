import models from '../../models/index.js';
 const Equipment = models['Equipment'];
class ManageEquipmentService {
    constructor() {
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };
        return {
            getEquipments: this.getEquipments.bind(this),
            addEquipment: this.addEquipment.bind(this),
            editEquipment: this.editEquipment.bind(this),
            deleteEquipment: this.deleteEquipment.bind(this)
        }
    }

    async getEquipments({ limit = 10, sortBy = 'name', orderBy = 1, skip, name }) {
        try {
            let result = {};
            let condition = {};
            if (name) {
                name = '.*' + name + '.*';
                condition['name'] = { $regex: new RegExp('^' + name + '$', 'i') };
            }
            result.equipments = await Equipment.find(condition)
                .limit(limit)
                .skip(skip)
                .sort({ [sortBy]: orderBy });
            result.count = await Equipment.countDocuments(condition);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async addEquipment({ name, icon }) {
        try {
            return await Equipment.create({ name, icon });
        } catch (error) {
            throw error;
        }
    }

    async editEquipment({ equipmentId, name, icon, updated_by }) {
        try {
            return await Equipment.findOneAndUpdate(
                { _id: equipmentId },
                { name, icon, updated_by },
                this.updateOptions);
        } catch (e) {
            throw (e)
        }
    }

    async deleteEquipment({ equipmentId }) {
        try {
            // const countAmenty = await WorkSpace.countDocuments({ amenties: equipmentId });
            // if (countAmenty > 0) {
            //     throw ({
            //         name: 'PPP',
            //         code: 400,
            //         message: 'Can not delete Amenty,Its exists in Work Space'
            //     })
            // }
            await Equipment.deleteOne({ _id: equipmentId });
            return true;
        } catch (error) {
            throw (error)
        }
    }
}

export default new ManageEquipmentService();