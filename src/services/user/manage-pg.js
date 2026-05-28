import mongoose from 'mongoose';
import models from '../../models/index.js';
import { formatPgForFrontend, toPgSlug } from '../../utilities/pg-response-formatter.js';

const PG = models.PG;

function httpError(statusCode, message) {
    const err = new Error(message);
    err.name = 'cofynd';
    err.code = statusCode;
    return err;
}

function isValidObjectId(value) {
    if (value == null || value === '') return false;
    return mongoose.Types.ObjectId.isValid(String(value));
}

function publicPgFilter() {
    return {
        delete: { $ne: true },
        active: true,
        status: 'approve',
        // adminApproved: true,
    };
}

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class ManagePgService {
    constructor() {
        return {
            getPgs: this.getPgs.bind(this),
            getPgByIdOrSlug: this.getPgByIdOrSlug.bind(this),
        };
    }

    /**
     * List PGs for public/user app.
     * Query: limit, skip, page, sortBy, orderBy, city, locality, name,
     * minPrice, maxPrice, verified, foodIncluded, parking, preferredGuest, type (availableFor)
     */
    async getPgs(query = {}) {
        const {
            limit = 20,
            skip,
            page,
            sortBy = 'added_on',
            orderBy = '-1',
            city,
            locality,
            name,
            minPrice,
            maxPrice,
            verified,
            foodIncluded,
            parking,
            preferredGuest,
            type,
        } = query;

        const condition = { ...publicPgFilter() };

        if (city) {
            condition.city = { $regex: escapeRegex(String(city).trim()), $options: 'i' };
        }
        if (locality) {
            condition.locality = {
                $regex: escapeRegex(String(locality).trim()),
                $options: 'i',
            };
        }
        if (name) {
            const safe = String(name).replace(/[^A-Za-z0-9 ]/g, '').trim();
            if (safe.length) {
                condition.name = { $regex: safe, $options: 'i' };
            }
        }
        if (verified === 'true' || verified === true) {
            condition.verified = true;
        }
        if (foodIncluded === 'true' || foodIncluded === true) {
            condition.foodIncluded = true;
        }
        if (parking === 'true' || parking === true) {
            condition.parking = true;
        }
        if (preferredGuest) {
            condition.preferredGuest = {
                $regex: escapeRegex(String(preferredGuest).trim()),
                $options: 'i',
            };
        }
        if (type) {
            condition.availableFor = {
                $regex: escapeRegex(String(type).trim()),
                $options: 'i',
            };
        }

        const minP = minPrice != null && minPrice !== '' ? Number(minPrice) : null;
        const maxP = maxPrice != null && maxPrice !== '' ? Number(maxPrice) : null;
        if (Number.isFinite(minP)) {
            condition.$and = condition.$and || [];
            condition.$and.push({
                $or: [
                    { maxMonthlyRent: { $gte: minP } },
                    { 'pgRooms.monthlyRent': { $gte: minP } },
                ],
            });
        }
        if (Number.isFinite(maxP)) {
            condition.$and = condition.$and || [];
            condition.$and.push({
                $or: [
                    { minMonthlyRent: { $lte: maxP } },
                    { 'pgRooms.monthlyRent': { $lte: maxP } },
                ],
            });
        }

        const lim = Math.min(Math.max(Number(limit) || 20, 1), 50);
        let sk = Math.max(Number(skip) || 0, 0);
        if (page != null && page !== '') {
            const p = Math.max(Number(page) || 1, 1);
            sk = (p - 1) * lim;
        }

        const sortField = ['added_on', 'rating', 'minMonthlyRent', 'maxMonthlyRent', 'name', 'views'].includes(
            sortBy,
        )
            ? sortBy
            : 'added_on';
        const sortDir = Number(orderBy) === 1 ? 1 : -1;
        const sort = { [sortField]: sortDir };

        const populateQuery = PG.find(condition)
            .populate('images.image')
            .sort(sort)
            .skip(sk)
            .limit(lim);

        const [docs, count] = await Promise.all([
            populateQuery.lean(),
            PG.countDocuments(condition),
        ]);

        return {
            pgs: docs.map((d) => formatPgForFrontend(d)).filter(Boolean),
            count,
        };
    }

    async getPgByIdOrSlug({ findKey }) {
        if (!findKey || !String(findKey).trim()) {
            throw httpError(400, 'PG id or slug is required');
        }

        const key = String(findKey).trim();
        const base = publicPgFilter();

        let doc = null;

        if (isValidObjectId(key)) {
            doc = await PG.findOne({ ...base, _id: key })
                .populate('images.image')
                .lean();
        }

        if (!doc) {
            doc = await PG.findOne({
                ...base,
                pg_id: new RegExp(`^${escapeRegex(key)}$`, 'i'),
            })
                .populate('images.image')
                .lean();
        }

        if (!doc) {
            doc = await PG.findOne({
                ...base,
                slug: new RegExp(`^${escapeRegex(key)}$`, 'i'),
            })
                .populate('images.image')
                .lean();
        }

        if (!doc) {
            const slugKey = key.toLowerCase();
            const nameGuess = key.replace(/-/g, ' ').trim();
            const candidates = await PG.find({
                ...base,
                $or: [
                    { name: new RegExp(escapeRegex(nameGuess), 'i') },
                    { pg_id: new RegExp(escapeRegex(key), 'i') },
                ],
            })
                .populate('images.image')
                .limit(25)
                .lean();

            doc =
                candidates.find((c) => toPgSlug(c) === slugKey) ||
                candidates.find((c) => String(c.pg_id || '').toLowerCase() === slugKey) ||
                (candidates.length === 1 ? candidates[0] : null);
        }

        if (!doc) {
            throw httpError(404, 'PG not found');
        }

        const pg = formatPgForFrontend(doc);
        return {
            id: String(doc._id),
            slug: pg?.slug || toPgSlug(doc),
            pg,
        };
    }
}

export default new ManagePgService();
