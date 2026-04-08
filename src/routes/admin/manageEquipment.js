import { Router } from 'express';
const router = Router();
import manageEquipment from '../../controllers/admin/ManageEquipment.js';

router.get('/equipments', manageEquipment.getEquipments)
    .post('/equipment', manageEquipment.addOrEditEquipment)
    .put('/equipment/:equipmentId', manageEquipment.addOrEditEquipment)
    .delete('/equipment/:equipmentId', manageEquipment.deleteEquipment)

export default router;
