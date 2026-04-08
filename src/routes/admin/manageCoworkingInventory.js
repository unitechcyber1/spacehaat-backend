import { Router } from 'express';
const router = Router();
import ManageCoworkingInventory from '../../controllers/admin/ManageCoworkingInventory.js';

router
    .get('/inventories', ManageCoworkingInventory.getCoworkingInventories)
    .get('/inventory/:inventoryId', ManageCoworkingInventory.getCoworkingInventoryById)
    .post('/inventory', ManageCoworkingInventory.createOrUpdateCoworkingInventory)
    .post('/upload-inventory', ManageCoworkingInventory.uploadInventory)
    .post('/register-lead', ManageCoworkingInventory.leadRegisterOnMail)
    .put('/inventory/:id', ManageCoworkingInventory.createOrUpdateCoworkingInventory)
    .delete('/inventory/delete/:id', ManageCoworkingInventory.deleteWorkSpaceInventory)

export default router;