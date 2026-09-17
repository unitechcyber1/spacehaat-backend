import mongoose from 'mongoose';
import models from '../../models/index.js';
import {
    applyCreatedByScope,
    assertBillingRecordAccess,
} from '../../utilities/billing/billingAccess.js';

const { ObjectId } = mongoose.Types;
const BillingClient = models['BillingClient'];
const Invoice = models['Invoice'];

class ManageBillingClientService {
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

    _throw(msg, code = 400) {
        throw { name: 'cofynd', code, message: msg };
    }

    getMeta() {
        return {
            statuses: ['active', 'inactive'],
            spaceTypes: ['Coworking Space', 'Office Space', 'PG', 'Coliving Space', 'Virtual Office'],
        };
    }

    async list({
        limit = 20,
        skip = 0,
        status = 'active',
        search,
        space_type,
        actorUser,
    } = {}) {
        let condition = {};
        if (status) condition.status = status;
        if (space_type) condition.default_space_type = space_type;
        if (search) {
            const rx = new RegExp(search.trim(), 'i');
            condition.$or = [
                { billing_name: rx },
                { company_name: rx },
                { billing_email: rx },
                { gstin: rx },
                { billing_phone: rx },
            ];
        }

        condition = applyCreatedByScope(condition, actorUser);

        const [data, count] = await Promise.all([
            BillingClient.find(condition).sort({ added_on: -1 }).skip(Number(skip)).limit(Number(limit)).lean(),
            BillingClient.countDocuments(condition),
        ]);

        return { data, count };
    }

    async getById({ id, actorUser }) {
        if (!id || !ObjectId.isValid(id)) this._throw('Invalid id');
        const doc = await BillingClient.findById(id).lean();
        if (!doc) this._throw('Billing client not found', 404);
        assertBillingRecordAccess(doc, actorUser);
        return doc;
    }

    async create(payload) {
        if (!payload?.billing_name?.trim()) this._throw('billing_name is required');

        const doc = await BillingClient.create({
            billing_name: payload.billing_name.trim(),
            billing_email: payload.billing_email?.trim(),
            billing_phone: payload.billing_phone?.trim(),
            company_name: payload.company_name?.trim(),
            gstin: payload.gstin?.trim(),
            pan: payload.pan?.trim(),
            is_gst_registered: !!payload.is_gst_registered,
            billing_address: payload.billing_address,
            place_of_supply_state: payload.place_of_supply_state,
            place_of_supply_state_code: payload.place_of_supply_state_code,
            ship_to_same_as_billing: payload.ship_to_same_as_billing !== false,
            ship_to_name: payload.ship_to_name?.trim(),
            ship_to_company_name: payload.ship_to_company_name?.trim(),
            ship_to_email: payload.ship_to_email?.trim(),
            ship_to_phone: payload.ship_to_phone?.trim(),
            ship_to_gstin: payload.ship_to_gstin?.trim(),
            shipping_address: payload.shipping_address,
            default_space_type: payload.default_space_type,
            status: payload.status || 'active',
            notes: payload.notes,
            created_by: payload.created_by,
        });

        return doc;
    }

    async update({ id, actorUser, ...payload }) {
        if (!id || !ObjectId.isValid(id)) this._throw('Invalid id');
        const doc = await BillingClient.findById(id);
        if (!doc) this._throw('Billing client not found', 404);
        assertBillingRecordAccess(doc, actorUser);

        const fields = [
            'billing_name', 'billing_email', 'billing_phone', 'company_name',
            'gstin', 'pan', 'is_gst_registered', 'billing_address',
            'place_of_supply_state', 'place_of_supply_state_code',
            'ship_to_same_as_billing', 'ship_to_name', 'ship_to_company_name', 'ship_to_email',
            'ship_to_phone', 'ship_to_gstin', 'shipping_address',
            'default_space_type', 'status', 'notes',
        ];
        for (const f of fields) {
            if (typeof payload[f] !== 'undefined') doc[f] = payload[f];
        }
        await doc.save();
        return doc;
    }

    async deactivate({ id, actorUser }) {
        return this.update({ id, actorUser, status: 'inactive' });
    }

    /**
     * Find existing billing client by gstin, then email+name, else create.
     */
    async findOrCreate(payload) {
        const { actorUser, ...rest } = payload;
        if (rest.billingClientId && ObjectId.isValid(rest.billingClientId)) {
            const existing = await this.getById({ id: rest.billingClientId, actorUser });
            return { client: existing, created: false };
        }

        if (!rest.billing_name?.trim()) this._throw('billing_name is required');

        const ownerScope = applyCreatedByScope({}, actorUser);

        if (rest.gstin?.trim()) {
            const byGst = await BillingClient.findOne({
                gstin: rest.gstin.trim(),
                status: 'active',
                ...ownerScope,
            });
            if (byGst) return { client: byGst.toObject(), created: false };
        }

        if (rest.billing_email?.trim()) {
            const byEmail = await BillingClient.findOne({
                billing_email: rest.billing_email.trim().toLowerCase(),
                billing_name: rest.billing_name.trim(),
                status: 'active',
                ...ownerScope,
            });
            if (byEmail) return { client: byEmail.toObject(), created: false };
        }

        const client = await this.create(rest);
        return { client, created: true };
    }

    async listInvoices({ id, limit = 20, skip = 0, status, actorUser }) {
        if (!id || !ObjectId.isValid(id)) this._throw('Invalid id');
        await this.getById({ id, actorUser });

        let condition = { billingClientId: id, party_type: 'client' };
        if (status) condition.status = status;
        condition = applyCreatedByScope(condition, actorUser);

        const [data, count] = await Promise.all([
            Invoice.find(condition).sort({ added_on: -1 }).skip(Number(skip)).limit(Number(limit)).lean(),
            Invoice.countDocuments(condition),
        ]);
        return { data, count };
    }
}

export default new ManageBillingClientService();
