import manageInvoice from '../../services/admin/manage-invoice.js';
import manageBillingProfile from '../../services/admin/manage-billing-profile.js';
import manageProductCatalog from '../../services/admin/manage-product-catalog.js';
import { actorUserFromRequest, resolveCreatedById } from '../../utilities/billing/billingAccess.js';

class ManageInvoiceController {
    constructor() {
        return {
            getMeta: this.getMeta.bind(this),
            getInvoiceNumberPreview: this.getInvoiceNumberPreview.bind(this),
            list: this.list.bind(this),
            getById: this.getById.bind(this),
            getHtml: this.getHtml.bind(this),
            getPreview: this.getPreview.bind(this),
            getPdf: this.getPdf.bind(this),
            generatePdf: this.generatePdf.bind(this),
            createFromCustomer: this.createFromCustomer.bind(this),
            createFromBillingClient: this.createFromBillingClient.bind(this),
            createDraft: this.createDraft.bind(this),
            updateDraft: this.updateDraft.bind(this),
            issue: this.issue.bind(this),
            send: this.send.bind(this),
            getSendPrefill: this.getSendPrefill.bind(this),
            createPaymentLink: this.createPaymentLink.bind(this),
            markPaid: this.markPaid.bind(this),
            cancel: this.cancel.bind(this),
            upsertClientBilling: this.upsertClientBilling.bind(this),
            getClientBilling: this.getClientBilling.bind(this),
            getBillingProfile: this.getBillingProfile.bind(this),
            updateBillingProfile: this.updateBillingProfile.bind(this),
            listCatalog: this.listCatalog.bind(this),
            createCatalogItem: this.createCatalogItem.bind(this),
            updateCatalogItem: this.updateCatalogItem.bind(this),
            deleteCatalogItem: this.deleteCatalogItem.bind(this),
            seedCatalog: this.seedCatalog.bind(this),
            listStateProfiles: this.listStateProfiles.bind(this),
            upsertStateProfile: this.upsertStateProfile.bind(this),
            removeStateProfile: this.removeStateProfile.bind(this),
            convertToTaxInvoice: this.convertToTaxInvoice.bind(this),
        };
    }

    async getMeta(req, res, next) {
        try {
            const data = await manageInvoice.getMeta();
            res.status(200).json({ message: 'Invoice metadata', data });
        } catch (e) { next(e); }
    }

    async getInvoiceNumberPreview(req, res, next) {
        try {
            const data = await manageInvoice.getInvoiceNumberPreview({
                space_type: req.query.space_type,
                invoice_type: req.query.invoice_type,
                seller_state_code: req.query.seller_state_code,
            });
            res.status(200).json({ message: 'Invoice number preview', data });
        } catch (e) { next(e); }
    }

    async list(req, res, next) {
        try {
            const result = await manageInvoice.list({ ...req.query, actorUser: actorUserFromRequest(req) });
            res.status(200).json({ message: 'Invoices', data: result.data, totalRecords: result.count });
        } catch (e) { next(e); }
    }

    async getById(req, res, next) {
        try {
            const data = await manageInvoice.getById({ id: req.params.id, actorUser: actorUserFromRequest(req) });
            res.status(200).json({ message: 'Invoice', data });
        } catch (e) { next(e); }
    }

    async getHtml(req, res, next) {
        try {
            const print = String(req.query.print || '') === '1';
            const format = req.query.format || req.query.raw;
            const data = await manageInvoice.getHtml({
                id: req.params.id,
                print,
                actorUser: actorUserFromRequest(req),
            });

            if (format === 'html') {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                return res.status(200).send(data.html);
            }

            res.status(200).json({ message: 'Invoice HTML', data });
        } catch (e) { next(e); }
    }

    async getPreview(req, res, next) {
        try {
            const data = await manageInvoice.getPreview({
                id: req.params.id,
                actorUser: actorUserFromRequest(req),
            });
            res.status(200).json({ message: 'Invoice preview', data });
        } catch (e) { next(e); }
    }

    async getPdf(req, res, next) {
        try {
            const download = String(req.query.download || '') === '1';
            const regenerate = String(req.query.regenerate || '') === '1';
            const result = await manageInvoice.getPdf({
                id: req.params.id,
                regenerate,
                actorUser: actorUserFromRequest(req),
            });

            if (result.from_cache && result.pdf_url && !regenerate && !result.buffer) {
                return res.redirect(result.pdf_url);
            }

            if (!result.buffer) {
                return res.status(404).json({ message: 'PDF not available' });
            }

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader(
                'Content-Disposition',
                `${download ? 'attachment' : 'inline'}; filename="${result.filename}"`
            );
            return res.status(200).send(result.buffer);
        } catch (e) { next(e); }
    }

    async generatePdf(req, res, next) {
        try {
            const data = await manageInvoice.generatePdf({
                id: req.params.id,
                store: req.body?.store !== false,
                actorUser: actorUserFromRequest(req),
            });
            res.status(200).json({
                message: 'Invoice PDF generated',
                data: {
                    pdf_url: data.pdf_url,
                    filename: data.filename,
                },
            });
        } catch (e) { next(e); }
    }

    async createFromCustomer(req, res, next) {
        try {
            const data = await manageInvoice.createDraftFromCustomer({
                ...req.body,
                created_by: resolveCreatedById(req),
                actorUser: actorUserFromRequest(req),
            });
            res.status(200).json({ message: 'Draft invoice created (legacy customer link)', data });
        } catch (e) { next(e); }
    }

    async createFromBillingClient(req, res, next) {
        try {
            const data = await manageInvoice.createDraftFromBillingClient({
                ...req.body,
                created_by: resolveCreatedById(req),
                actorUser: actorUserFromRequest(req),
            });
            res.status(200).json({ message: 'Draft invoice created', data });
        } catch (e) { next(e); }
    }

    async createDraft(req, res, next) {
        try {
            const data = await manageInvoice.createDraft({
                ...req.body,
                created_by: resolveCreatedById(req),
                actorUser: actorUserFromRequest(req),
            });
            res.status(200).json({ message: 'Draft invoice created', data });
        } catch (e) { next(e); }
    }

    async updateDraft(req, res, next) {
        try {
            const data = await manageInvoice.updateDraft({
                id: req.params.id,
                ...req.body,
                actorUser: actorUserFromRequest(req),
            });
            res.status(200).json({ message: 'Draft updated', data });
        } catch (e) { next(e); }
    }

    async issue(req, res, next) {
        try {
            const data = await manageInvoice.issue({
                id: req.params.id,
                invoice_type: req.body?.invoice_type,
                created_by: resolveCreatedById(req),
                actorUser: actorUserFromRequest(req),
            });
            res.status(200).json({ message: 'Invoice issued', data });
        } catch (e) { next(e); }
    }

    async convertToTaxInvoice(req, res, next) {
        try {
            const data = await manageInvoice.convertToTaxInvoice({
                id: req.params.id,
                created_by: resolveCreatedById(req),
                actorUser: actorUserFromRequest(req),
            });
            res.status(200).json({ message: 'Converted to tax invoice', data });
        } catch (e) { next(e); }
    }

    async getSendPrefill(req, res, next) {
        try {
            const data = await manageInvoice.getSendPrefill({
                id: req.params.id,
                adminEmail: req.user?.email,
                actorUser: actorUserFromRequest(req),
            });
            res.status(200).json({ message: 'Invoice send prefill', data });
        } catch (e) { next(e); }
    }

    async send(req, res, next) {
        try {
            const data = await manageInvoice.send({
                id: req.params.id,
                to: req.body?.to,
                cc: req.body?.cc,
                bcc: req.body?.bcc,
                reply_to: req.body?.reply_to,
                subject: req.body?.subject,
                message: req.body?.message,
                attach_pdf: req.body?.attach_pdf !== false,
                includePaymentLink: req.body?.include_payment_link !== false
                    && req.body?.includePaymentLink !== false,
                invoice_type: req.body?.invoice_type,
                sent_by: resolveCreatedById(req),
                actorUser: actorUserFromRequest(req),
            });
            res.status(200).json({ message: 'Invoice sent', data });
        } catch (e) { next(e); }
    }

    async createPaymentLink(req, res, next) {
        try {
            const data = await manageInvoice.createPaymentLink({
                id: req.params.id,
                actorUser: actorUserFromRequest(req),
            });
            res.status(200).json({ message: 'Payment link created', data });
        } catch (e) { next(e); }
    }

    async markPaid(req, res, next) {
        try {
            const data = await manageInvoice.markPaid({
                id: req.params.id,
                ...req.body,
                issue_tax_invoice_on_payment: req.body?.issue_tax_invoice_on_payment === true,
                actorUser: actorUserFromRequest(req),
            });
            res.status(200).json({ message: 'Invoice marked paid', data });
        } catch (e) { next(e); }
    }

    async cancel(req, res, next) {
        try {
            const data = await manageInvoice.cancel({
                id: req.params.id,
                actorUser: actorUserFromRequest(req),
            });
            res.status(200).json({ message: 'Invoice cancelled', data });
        } catch (e) { next(e); }
    }

    async upsertClientBilling(req, res, next) {
        try {
            const data = await manageInvoice.upsertClientBilling({
                customerId: req.params.customerId,
                ...req.body,
            });
            res.status(200).json({ message: 'Client billing profile saved', data });
        } catch (e) { next(e); }
    }

    async getClientBilling(req, res, next) {
        try {
            const data = await manageInvoice.getClientBilling({ customerId: req.params.customerId });
            res.status(200).json({ message: 'Client billing profile', data });
        } catch (e) { next(e); }
    }

    async getBillingProfile(req, res, next) {
        try {
            const data = await manageBillingProfile.getOrCreate();
            res.status(200).json({ message: 'Billing profile', data });
        } catch (e) { next(e); }
    }

    async updateBillingProfile(req, res, next) {
        try {
            const data = await manageBillingProfile.update(req.body);
            res.status(200).json({ message: 'Billing profile updated', data });
        } catch (e) { next(e); }
    }

    async listCatalog(req, res, next) {
        try {
            const result = await manageProductCatalog.list(req.query);
            res.status(200).json({ message: 'Product catalog', data: result.data, totalRecords: result.count });
        } catch (e) { next(e); }
    }

    async createCatalogItem(req, res, next) {
        try {
            const data = await manageProductCatalog.create(req.body);
            res.status(200).json({ message: 'Catalog item created', data });
        } catch (e) { next(e); }
    }

    async updateCatalogItem(req, res, next) {
        try {
            const data = await manageProductCatalog.update({ id: req.params.id, ...req.body });
            res.status(200).json({ message: 'Catalog item updated', data });
        } catch (e) { next(e); }
    }

    async deleteCatalogItem(req, res, next) {
        try {
            await manageProductCatalog.remove({ id: req.params.id });
            res.status(200).json({ message: 'Catalog item deleted' });
        } catch (e) { next(e); }
    }

    async seedCatalog(req, res, next) {
        try {
            const data = await manageProductCatalog.seedDefaults();
            res.status(200).json({ message: 'Default catalog seeded', data });
        } catch (e) { next(e); }
    }

    async listStateProfiles(req, res, next) {
        try {
            const data = await manageBillingProfile.listStateProfiles();
            res.status(200).json({ message: 'State GST profiles', data });
        } catch (e) { next(e); }
    }

    async upsertStateProfile(req, res, next) {
        try {
            const data = await manageBillingProfile.upsertStateProfile(req.body);
            res.status(200).json({ message: 'State GST profile saved', data });
        } catch (e) { next(e); }
    }

    async removeStateProfile(req, res, next) {
        try {
            const data = await manageBillingProfile.removeStateProfile({ state_code: req.params.stateCode });
            res.status(200).json({ message: 'State GST profile removed', data });
        } catch (e) { next(e); }
    }
}

export default new ManageInvoiceController();
