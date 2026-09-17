import manageBillingClient from '../../services/admin/manage-billing-client.js';
import { actorUserFromRequest, resolveCreatedById } from '../../utilities/billing/billingAccess.js';

class ManageBillingClientController {
    constructor() {
        return {
            getMeta: this.getMeta.bind(this),
            list: this.list.bind(this),
            getById: this.getById.bind(this),
            create: this.create.bind(this),
            update: this.update.bind(this),
            deactivate: this.deactivate.bind(this),
            findOrCreate: this.findOrCreate.bind(this),
            listInvoices: this.listInvoices.bind(this),
        };
    }

    async getMeta(req, res, next) {
        try {
            res.status(200).json({ message: 'Billing client metadata', data: manageBillingClient.getMeta() });
        } catch (e) { next(e); }
    }

    async list(req, res, next) {
        try {
            const result = await manageBillingClient.list({
                ...req.query,
                actorUser: actorUserFromRequest(req),
            });
            res.status(200).json({ message: 'Billing clients', data: result.data, totalRecords: result.count });
        } catch (e) { next(e); }
    }

    async getById(req, res, next) {
        try {
            const data = await manageBillingClient.getById({
                id: req.params.id,
                actorUser: actorUserFromRequest(req),
            });
            res.status(200).json({ message: 'Billing client', data });
        } catch (e) { next(e); }
    }

    async create(req, res, next) {
        try {
            const data = await manageBillingClient.create({ ...req.body, created_by: resolveCreatedById(req) });
            res.status(200).json({ message: 'Billing client created', data });
        } catch (e) { next(e); }
    }

    async update(req, res, next) {
        try {
            const data = await manageBillingClient.update({
                id: req.params.id,
                ...req.body,
                actorUser: actorUserFromRequest(req),
            });
            res.status(200).json({ message: 'Billing client updated', data });
        } catch (e) { next(e); }
    }

    async deactivate(req, res, next) {
        try {
            const data = await manageBillingClient.deactivate({
                id: req.params.id,
                actorUser: actorUserFromRequest(req),
            });
            res.status(200).json({ message: 'Billing client deactivated', data });
        } catch (e) { next(e); }
    }

    async findOrCreate(req, res, next) {
        try {
            const data = await manageBillingClient.findOrCreate({
                ...req.body,
                created_by: resolveCreatedById(req),
                actorUser: actorUserFromRequest(req),
            });
            res.status(200).json({
                message: data.created ? 'Billing client created' : 'Billing client found',
                data,
            });
        } catch (e) { next(e); }
    }

    async listInvoices(req, res, next) {
        try {
            const result = await manageBillingClient.listInvoices({
                id: req.params.id,
                ...req.query,
                actorUser: actorUserFromRequest(req),
            });
            res.status(200).json({ message: 'Billing client invoices', data: result.data, totalRecords: result.count });
        } catch (e) { next(e); }
    }
}

export default new ManageBillingClientController();
