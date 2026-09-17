import { Router } from 'express';
import ManageBillingClient from '../../controllers/admin/ManageBillingClient.js';

const router = Router();
const c = ManageBillingClient;

router.get('/billing-clients/meta', c.getMeta);
router.get('/billing-clients', c.list);
router.post('/billing-clients', c.create);
router.post('/billing-clients/find-or-create', c.findOrCreate);
router.get('/billing-clients/:id', c.getById);
router.put('/billing-clients/:id', c.update);
router.post('/billing-clients/:id/deactivate', c.deactivate);
router.get('/billing-clients/:id/invoices', c.listInvoices);

export default router;
