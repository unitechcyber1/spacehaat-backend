import mongoose from 'mongoose';
import models from '../../models/index.js';
import { formatPgForFrontend, toPgSlug } from '../../utilities/pg-response-formatter.js';
import { createDynamicPriorityType } from '../../utilities/pg-priority.js';

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

/**
 * @returns {null | {
 *   priorityType: string,
 *   priorityIsActiveField: string,
 *   priorityOrderField: string,
 *   priorityOnly: boolean,
 * }}
 */
function parsePriorityQuery(query) {
    const priorityType = query.priorityType || query.priority_type;
    if (!priorityType) return null;

    const virtualPriority =
        query.virtualPriority === true ||
        query.virtualPriority === 'true' ||
        query.virtual_priority === true ||
        query.virtual_priority === 'true';

    const dynamicPriorityBase = createDynamicPriorityType(priorityType, virtualPriority);
    if (!dynamicPriorityBase) {
        throw httpError(400, 'priorityType must be overall, location, or micro_location');
    }

    const priorityOnly =
        query.priorityOnly === true ||
        query.priorityOnly === 'true' ||
        query.priority_only === true ||
        query.priority_only === 'true';

    const priorityCity = query.priorityCity || query.priority_city;
    if (priorityType === 'location' || priorityType === 'micro_location') {
        if (!priorityCity) {
            throw httpError(400, 'priorityCity is required when priorityType is location or micro_location');
        }
        if (!isValidObjectId(priorityCity)) {
            throw httpError(400, 'priorityCity must be a valid City id');
        }
    }

    return {
        priorityType,
        priorityIsActiveField: `${dynamicPriorityBase}.is_active`,
        priorityOrderField: `${dynamicPriorityBase}.order`,
        priorityCity,
        priorityOnly,
    };
}

/** Apply priority filters; default = priority PGs first + rest of matching PGs. */
function applyPriorityToCondition(condition, parsed) {
    if (!parsed) return;

    if (parsed.priorityOnly) {
        condition[parsed.priorityIsActiveField] = true;
    }

    // City / locality priority lists: scope full result set to this city
    if (
        parsed.priorityCity &&
        (parsed.priorityType === 'location' || parsed.priorityType === 'micro_location')
    ) {
        condition['locationIds.city'] = parsed.priorityCity;
    }
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
     *
     * Priority (optional, on same endpoint):
     *   priorityType=overall|location|micro_location
     *   priorityCity=<City ObjectId>  (required for location / micro_location)
     *   virtualPriority=true|false
     *   priorityOnly=true  — return only active priority PGs (default: false = priority first, then rest)
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

        const priorityParsed = parsePriorityQuery(query);
        applyPriorityToCondition(condition, priorityParsed);

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

        let sort;
        if (priorityParsed) {
            // Active priority slots first (by order), then remaining PGs (by sortBy)
            sort = {
                [priorityParsed.priorityIsActiveField]: -1,
                [priorityParsed.priorityOrderField]: 1,
                [sortField]: sortDir,
            };
        } else {
            sort = { [sortField]: sortDir };
        }

        const populateQuery = PG.find(condition)
            .populate('images.image')
            .populate('locationIds.city')
            .populate('locationIds.micro_location')
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
