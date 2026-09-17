import mongoose from 'mongoose';
import models from '../../models/index.js';

const { ObjectId } = mongoose.Types;
const ProductCatalogItem = models['ProductCatalogItem'];

const DEFAULT_CATALOG = [
    {
        sku: 'CW-COMMISSION',
        name: 'Coworking — Commission',
        description: 'Brokerage / commission for coworking space',
        space_type: 'Coworking Space',
        category: 'service',
        unit: 'flat',
        default_rate: 0,
        tax_rate: 18,
        hsn_sac: '997212',
        sort_order: 10,
    },
    {
        sku: 'OS-COMMISSION',
        name: 'Office Space — Commission',
        description: 'Brokerage / commission for office space',
        space_type: 'Office Space',
        category: 'service',
        unit: 'flat',
        default_rate: 0,
        tax_rate: 18,
        hsn_sac: '997212',
        sort_order: 10,
    },
    {
        sku: 'PG-COMMISSION',
        name: 'PG — Commission',
        description: 'Brokerage / commission for PG listing',
        space_type: 'PG',
        category: 'service',
        unit: 'flat',
        default_rate: 0,
        tax_rate: 18,
        hsn_sac: '997212',
        sort_order: 10,
    },
    {
        sku: 'CL-COMMISSION',
        name: 'Coliving — Commission',
        description: 'Brokerage / commission for coliving space',
        space_type: 'Coliving Space',
        category: 'service',
        unit: 'flat',
        default_rate: 0,
        tax_rate: 18,
        hsn_sac: '997212',
        sort_order: 10,
    },
    {
        sku: 'VO-COMMISSION',
        name: 'Virtual Office — Commission',
        description: 'Brokerage / commission for virtual office',
        space_type: 'Virtual Office',
        category: 'service',
        unit: 'flat',
        default_rate: 0,
        tax_rate: 18,
        hsn_sac: '997212',
        sort_order: 10,
    },
];

class ManageProductCatalogService {
    constructor() {
        return {
            seedDefaults: this.seedDefaults.bind(this),
            list: this.list.bind(this),
            create: this.create.bind(this),
            update: this.update.bind(this),
            remove: this.remove.bind(this),
            getById: this.getById.bind(this),
        };
    }

    _throw(msg, code = 400) {
        throw { name: 'spacehaat', code, message: msg };
    }

    async seedDefaults() {
        for (const item of DEFAULT_CATALOG) {
            await ProductCatalogItem.findOneAndUpdate(
                { sku: item.sku },
                { $setOnInsert: item },
                { upsert: true }
            );
        }
        return ProductCatalogItem.find({ sku: { $in: DEFAULT_CATALOG.map((i) => i.sku) } }).lean();
    }

    async list(query = {}) {
        const limit = Math.min(Number(query.limit) || 100, 500);
        const skip = Number(query.skip) || 0;
        const filter = {};
        if (query.space_type) filter.space_type = query.space_type;
        if (query.enabled === 'false') filter.enabled = false;
        else if (query.enabled !== 'all') filter.enabled = { $ne: false };

        const [data, totalRecords] = await Promise.all([
            ProductCatalogItem.find(filter).sort({ sort_order: 1, name: 1 }).skip(skip).limit(limit).lean(),
            ProductCatalogItem.countDocuments(filter),
        ]);
        return { data, totalRecords };
    }

    async getById(id) {
        if (!ObjectId.isValid(id)) this._throw('Invalid catalog item id');
        const doc = await ProductCatalogItem.findById(id).lean();
        if (!doc) this._throw('Catalog item not found', 404);
        return doc;
    }

    async create(payload = {}) {
        const doc = await ProductCatalogItem.create(payload);
        return doc.toObject();
    }

    async update(id, payload = {}) {
        if (!ObjectId.isValid(id)) this._throw('Invalid catalog item id');
        const doc = await ProductCatalogItem.findByIdAndUpdate(id, { $set: payload }, { new: true }).lean();
        if (!doc) this._throw('Catalog item not found', 404);
        return doc;
    }

    async remove(id) {
        if (!ObjectId.isValid(id)) this._throw('Invalid catalog item id');
        const doc = await ProductCatalogItem.findByIdAndDelete(id).lean();
        if (!doc) this._throw('Catalog item not found', 404);
        return doc;
    }
}

export default new ManageProductCatalogService();
