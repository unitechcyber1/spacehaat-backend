import { Router } from 'express';
const router = Router();
import ManageCustomer from '../../controllers/admin/ManageCustomer.js';

router
    .get('/customers', ManageCustomer.getCustomerInventories)
    .get('/customer/:customerId', ManageCustomer.getCustomerInventoryById)
    .post('/customer', ManageCustomer.createOrUpdateCustomerInventory)
    .post('/upload-customer', ManageCustomer.uploadInventory)
    .put('/customer/:id', ManageCustomer.createOrUpdateCustomerInventory)
    .delete('/customer/delete/:id', ManageCustomer.deleteWorkSpaceInventory)

export default router;