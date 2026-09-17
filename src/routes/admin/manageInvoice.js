import { Router } from 'express';
import ManageInvoice from '../../controllers/admin/ManageInvoice.js';

const router = Router();
const c = ManageInvoice;

router.get('/invoices/meta', c.getMeta);
router.get('/invoices/number-preview', c.getInvoiceNumberPreview);
router.get('/invoices', c.list);
router.post('/invoices/from-customer', c.createFromCustomer);
router.post('/invoices/from-billing-client', c.createFromBillingClient);
router.post('/invoices', c.createDraft);
router.get('/invoices/:id', c.getById);
router.get('/invoices/:id/preview', c.getPreview);
router.get('/invoices/:id/pdf', c.getPdf);
router.post('/invoices/:id/generate-pdf', c.generatePdf);
router.get('/invoices/:id/html', c.getHtml);
router.put('/invoices/:id', c.updateDraft);
router.post('/invoices/:id/issue', c.issue);
router.post('/invoices/:id/convert-to-tax', c.convertToTaxInvoice);
router.get('/invoices/:id/send/prefill', c.getSendPrefill);
router.post('/invoices/:id/send', c.send);
router.post('/invoices/:id/payment-link', c.createPaymentLink);
router.post('/invoices/:id/mark-paid', c.markPaid);
router.post('/invoices/:id/cancel', c.cancel);

router.get('/billing-profile', c.getBillingProfile);
router.put('/billing-profile', c.updateBillingProfile);
router.get('/billing-profile/state-profiles', c.listStateProfiles);
router.post('/billing-profile/state-profiles', c.upsertStateProfile);
router.delete('/billing-profile/state-profiles/:stateCode', c.removeStateProfile);

router.get('/product-catalog', c.listCatalog);
router.post('/product-catalog/seed', c.seedCatalog);
router.post('/product-catalog', c.createCatalogItem);
router.put('/product-catalog/:id', c.updateCatalogItem);
router.delete('/product-catalog/:id', c.deleteCatalogItem);

router.get('/customers/:customerId/billing-profile', c.getClientBilling);
router.put('/customers/:customerId/billing-profile', c.upsertClientBilling);

export default router;
