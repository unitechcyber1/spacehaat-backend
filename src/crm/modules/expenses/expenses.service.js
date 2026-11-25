import { Types } from 'mongoose';
import models from '../../../models/index.js';
import { ApiError } from '../../utils/apiError.js';
import { isAdmin } from '../auth/permissions.js';
import { User, activeStaffFilter } from '../users/users.model.js';
import { notifyUser } from '../devices/devices.service.js';

const Expense = models.Expense;
const ExpenseCategory = models.ExpenseCategory;

const DEFAULT_CATEGORIES = [
    { name: 'Travel', icon: 'car-outline', order: 1 },
    { name: 'Food', icon: 'fast-food-outline', order: 2 },
    { name: 'Client expense', icon: 'briefcase-outline', order: 3 },
    { name: 'Other', icon: 'pricetag-outline', order: 4 },
];

const oid = (id) => new Types.ObjectId(String(id));
const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Today in India as `YYYY-MM-DD`. */
export function todayIst() {
    return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

/** First and last day of the month `YYYY-MM` (default: this month). */
function monthRange(month) {
    const ym = /^\d{4}-\d{2}$/.test(month || '') ? month : todayIst().slice(0, 7);
    const [y, m] = ym.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
}

function dateRange(query) {
    const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    if (isDay(query.from) || isDay(query.to)) {
        return { from: isDay(query.from) ? query.from : '0000-01-01', to: isDay(query.to) ? query.to : '9999-12-31' };
    }
    if (query.month === 'all') return null;
    return monthRange(query.month);
}

/** Members only ever see expenses that are theirs. */
function scopeFor(user) {
    return isAdmin(user) ? {} : { 'person.userId': oid(user.id) };
}

// ---------------------------------------------------------------- categories

export async function ensureDefaultCategories() {
    if (await ExpenseCategory.exists({})) return;
    await ExpenseCategory.insertMany(DEFAULT_CATEGORIES);
}

const toCategory = (c) => ({
    id: String(c._id),
    name: c.name,
    icon: c.icon || 'pricetag-outline',
    active: c.active !== false,
    order: c.order ?? 100,
});

export async function listCategories({ includeArchived = false } = {}) {
    await ensureDefaultCategories();
    const docs = await ExpenseCategory.find(includeArchived ? {} : { active: { $ne: false } })
        .sort({ order: 1, name: 1 })
        .lean();
    return docs.map(toCategory);
}

async function assertUniqueName(name, exceptId) {
    const clash = await ExpenseCategory.findOne({
        name: new RegExp(`^${escapeRegex(name)}$`, 'i'),
        ...(exceptId ? { _id: { $ne: oid(exceptId) } } : {}),
    }).lean();
    if (clash) throw new ApiError(409, `A category named "${clash.name}" already exists`, 'CATEGORY_EXISTS');
}

export async function createCategory(input, user) {
    await ensureDefaultCategories();
    await assertUniqueName(input.name);
    const last = await ExpenseCategory.findOne({}).sort({ order: -1 }).lean();
    const doc = await ExpenseCategory.create({
        name: input.name,
        icon: input.icon || 'pricetag-outline',
        order: (last?.order ?? 0) + 1,
        createdBy: oid(user.id),
    });
    return toCategory(doc);
}

export async function updateCategory(id, input) {
    if (!Types.ObjectId.isValid(id)) throw new ApiError(404, 'Category not found', 'NOT_FOUND');
    if (input.name) await assertUniqueName(input.name, id);
    const doc = await ExpenseCategory.findByIdAndUpdate(id, { $set: input }, { new: true }).lean();
    if (!doc) throw new ApiError(404, 'Category not found', 'NOT_FOUND');
    return toCategory(doc);
}

// ---------------------------------------------------------------- expenses

async function lookupMaps(docs) {
    const categoryIds = [...new Set(docs.map((d) => String(d.categoryId)))];
    const userIds = [
        ...new Set(docs.flatMap((d) => [d.person?.userId, d.createdBy].filter(Boolean).map(String))),
    ];
    const [cats, users] = await Promise.all([
        ExpenseCategory.find({ _id: { $in: categoryIds.map(oid) } }).lean(),
        User.find({ _id: { $in: userIds.map(oid) } }).select('name').lean(),
    ]);
    return {
        categories: new Map(cats.map((c) => [String(c._id), toCategory(c)])),
        users: new Map(users.map((u) => [String(u._id), u.name || ''])),
    };
}

function canEdit(user, doc) {
    if (isAdmin(user)) return true;
    return String(doc.person?.userId || '') === String(user.id) && !doc.settled;
}

function toExpense(doc, maps, user) {
    const personId = doc.person?.userId ? String(doc.person.userId) : null;
    const category = maps.categories.get(String(doc.categoryId)) || { id: String(doc.categoryId), name: 'Deleted category', icon: 'pricetag-outline', active: false };
    return {
        id: String(doc._id),
        amount: doc.amount,
        date: doc.date,
        category,
        note: doc.note || '',
        person: { userId: personId, name: (personId && maps.users.get(personId)) || doc.person?.name || '' },
        paidBy: doc.paidBy,
        paidByName: doc.paidByName || '',
        settled: Boolean(doc.settled),
        settledAt: doc.settledAt || null,
        needsSettling: doc.paidBy !== 'company' && !doc.settled,
        receipt: doc.receipt?.url ? { key: doc.receipt.key || '', url: doc.receipt.url } : null,
        createdBy: { id: String(doc.createdBy), name: maps.users.get(String(doc.createdBy)) || '' },
        createdAt: doc.createdAt,
        canEdit: canEdit(user, doc),
    };
}

/** Whose expense: members are always themselves; admins may pick a staff user or type any name. */
async function resolvePerson(user, input, current) {
    if (!isAdmin(user)) return { userId: oid(user.id), name: user.name || '' };
    if (input.personUserId) {
        const staff = await User.findOne({ _id: oid(input.personUserId), ...activeStaffFilter }).select('name').lean();
        if (!staff) throw new ApiError(400, 'That team member was not found', 'PERSON_NOT_FOUND');
        return { userId: staff._id, name: staff.name || '' };
    }
    if (input.personName) return { userId: null, name: input.personName };
    if (current) return current;
    return { userId: oid(user.id), name: user.name || '' };
}

async function assertCategory(categoryId) {
    const cat = await ExpenseCategory.findOne({ _id: oid(categoryId), active: { $ne: false } }).lean();
    if (!cat) throw new ApiError(400, 'Choose a category', 'CATEGORY_NOT_FOUND');
    return cat;
}

function buildFilter(user, query) {
    const filter = { ...scopeFor(user) };
    const range = dateRange(query);
    if (range) filter.date = { $gte: range.from, $lte: range.to };
    if (typeof query.categoryId === 'string' && Types.ObjectId.isValid(query.categoryId)) filter.categoryId = oid(query.categoryId);
    if (['company', 'self', 'other'].includes(query.paidBy)) filter.paidBy = query.paidBy;
    if (query.settled === 'pending') {
        filter.paidBy = filter.paidBy && filter.paidBy !== 'company' ? filter.paidBy : { $in: ['self', 'other'] };
        filter.settled = { $ne: true };
    }
    if (isAdmin(user) && typeof query.person === 'string' && query.person) {
        if (Types.ObjectId.isValid(query.person)) filter['person.userId'] = oid(query.person);
        else if (query.person.startsWith('name:')) {
            filter['person.userId'] = null;
            filter['person.name'] = new RegExp(`^${escapeRegex(query.person.slice(5))}$`, 'i');
        }
    }
    if (typeof query.search === 'string' && query.search.trim()) {
        filter.note = new RegExp(escapeRegex(query.search.trim()), 'i');
    }
    return filter;
}

export async function listExpenses(user, query = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
    const filter = buildFilter(user, query);
    const [docs, total] = await Promise.all([
        Expense.find(filter).sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Expense.countDocuments(filter),
    ]);
    const maps = await lookupMaps(docs);
    return { items: docs.map((d) => toExpense(d, maps, user)), total, page, limit, hasMore: page * limit < total };
}

export async function getExpense(user, id) {
    if (!Types.ObjectId.isValid(id)) throw new ApiError(404, 'Expense not found', 'NOT_FOUND');
    const doc = await Expense.findOne({ _id: oid(id), ...scopeFor(user) }).lean();
    if (!doc) throw new ApiError(404, 'Expense not found', 'NOT_FOUND');
    return toExpense(doc, await lookupMaps([doc]), user);
}

/**
 * Totals for the dashboard: for the chosen month (or range) by category, person and who paid, plus
 * today's spend and everything still to be paid back (any month). Members get their own figures.
 */
export async function expenseSummary(user, query = {}) {
    const scope = scopeFor(user);
    const filter = buildFilter(user, query);
    const range = dateRange(query);

    const sumBy = (key) => [{ $match: filter }, { $group: { _id: key, total: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { total: -1 } }];
    const [overall, byCategory, byPaidBy, byPerson, today, pending] = await Promise.all([
        Expense.aggregate(sumBy(null)),
        Expense.aggregate(sumBy('$categoryId')),
        Expense.aggregate(sumBy('$paidBy')),
        isAdmin(user)
            ? Expense.aggregate(sumBy({ userId: '$person.userId', name: { $cond: [{ $eq: ['$person.userId', null] }, '$person.name', ''] } }))
            : Promise.resolve([]),
        Expense.aggregate([{ $match: { ...scope, date: todayIst() } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
        Expense.aggregate([
            { $match: { ...scope, paidBy: { $in: ['self', 'other'] }, settled: { $ne: true } } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
    ]);

    const cats = await ExpenseCategory.find({ _id: { $in: byCategory.map((r) => r._id).filter(Boolean) } }).lean();
    const catMap = new Map(cats.map((c) => [String(c._id), toCategory(c)]));
    const personIds = byPerson.map((r) => r._id?.userId).filter(Boolean);
    const people = personIds.length ? await User.find({ _id: { $in: personIds } }).select('name').lean() : [];
    const nameOf = new Map(people.map((u) => [String(u._id), u.name || '']));

    return {
        range,
        total: overall[0]?.total || 0,
        count: overall[0]?.count || 0,
        today: { total: today[0]?.total || 0, count: today[0]?.count || 0 },
        toSettle: { total: pending[0]?.total || 0, count: pending[0]?.count || 0 },
        byCategory: byCategory.map((r) => ({
            category: catMap.get(String(r._id)) || { id: String(r._id), name: 'Deleted category', icon: 'pricetag-outline' },
            total: r.total,
            count: r.count,
        })),
        byPaidBy: byPaidBy.map((r) => ({ paidBy: r._id, total: r.total, count: r.count })),
        byPerson: byPerson.map((r) => {
            const userId = r._id?.userId ? String(r._id.userId) : null;
            return {
                key: userId || `name:${r._id?.name || ''}`,
                userId,
                name: (userId && nameOf.get(userId)) || r._id?.name || 'Unknown',
                total: r.total,
                count: r.count,
            };
        }),
    };
}

/** People an admin can file an expense for: active staff, plus names used before for non-staff. */
export async function listExpensePeople() {
    const [staff, names] = await Promise.all([
        User.find(activeStaffFilter).select('name').sort({ name: 1 }).lean(),
        Expense.distinct('person.name', { 'person.userId': null, 'person.name': { $ne: '' } }),
    ]);
    return {
        staff: staff.map((u) => ({ userId: String(u._id), name: u.name || '' })),
        others: names.sort((a, b) => a.localeCompare(b)),
    };
}

async function notifyAdminsOfExpense(expense, user) {
    const admins = await User.find({ ...activeStaffFilter, role: 'admin', _id: { $ne: oid(user.id) } }).select('_id').lean();
    if (!admins.length) return;
    const body = [user.name, expense.category.name, expense.note].filter(Boolean).join(' · ');
    await Promise.all(
        admins.map((a) =>
            notifyUser(String(a._id), {
                title: `New expense · ${rupees(expense.amount)}`,
                body,
                data: { type: 'expense_created', expenseId: expense.id },
            }),
        ),
    );
}

export async function createExpense(user, input) {
    await assertCategory(input.categoryId);
    const person = await resolvePerson(user, input);
    const doc = await Expense.create({
        amount: Math.round(input.amount * 100) / 100,
        date: input.date,
        categoryId: oid(input.categoryId),
        note: input.note || '',
        person,
        paidBy: input.paidBy,
        paidByName: input.paidBy === 'other' ? input.paidByName : '',
        receipt: input.receipt?.url ? input.receipt : { key: '', url: '' },
        createdBy: oid(user.id),
    });
    const expense = toExpense(doc.toObject(), await lookupMaps([doc]), user);
    // Only expenses added by team members alert the admins; an admin's own entries do not notify anyone.
    if (!isAdmin(user)) {
        notifyAdminsOfExpense(expense, user).catch((err) => console.error('[expenses] notify failed', err));
    }
    return expense;
}

async function loadEditable(user, id) {
    if (!Types.ObjectId.isValid(id)) throw new ApiError(404, 'Expense not found', 'NOT_FOUND');
    const doc = await Expense.findOne({ _id: oid(id), ...scopeFor(user) });
    if (!doc) throw new ApiError(404, 'Expense not found', 'NOT_FOUND');
    if (!canEdit(user, doc)) {
        throw new ApiError(403, 'This expense has been paid back, so only an admin can change it', 'EXPENSE_LOCKED');
    }
    return doc;
}

export async function updateExpense(user, id, input) {
    const doc = await loadEditable(user, id);
    // An expense may keep a category that was archived later; only a change must be to an active one.
    if (input.categoryId && input.categoryId !== String(doc.categoryId)) {
        await assertCategory(input.categoryId);
        doc.categoryId = oid(input.categoryId);
    }
    if (input.amount != null) doc.amount = Math.round(input.amount * 100) / 100;
    if (input.date) doc.date = input.date;
    if (input.note != null) doc.note = input.note;
    if (isAdmin(user) && (input.personUserId || input.personName)) {
        doc.person = await resolvePerson(user, input, doc.person);
    }
    if (input.paidBy) doc.paidBy = input.paidBy;
    if (input.paidBy || input.paidByName != null) {
        doc.paidByName = doc.paidBy === 'other' ? input.paidByName ?? doc.paidByName : '';
        if (doc.paidBy === 'other' && !doc.paidByName) throw new ApiError(400, 'Who paid?', 'PAID_BY_NAME');
    }
    if (doc.paidBy === 'company') {
        doc.settled = false;
        doc.settledAt = null;
    }
    if (input.receipt !== undefined) doc.receipt = input.receipt?.url ? input.receipt : { key: '', url: '' };
    doc.updatedBy = oid(user.id);
    await doc.save();
    return toExpense(doc.toObject(), await lookupMaps([doc]), user);
}

export async function deleteExpense(user, id) {
    const doc = await loadEditable(user, id);
    await doc.deleteOne();
}

/** Admin: mark money the company owed for this expense as paid back (or undo). */
export async function settleExpense(user, id, settled) {
    if (!Types.ObjectId.isValid(id)) throw new ApiError(404, 'Expense not found', 'NOT_FOUND');
    const doc = await Expense.findById(id);
    if (!doc) throw new ApiError(404, 'Expense not found', 'NOT_FOUND');
    if (doc.paidBy === 'company') throw new ApiError(400, 'The company paid this one, so there is nothing to pay back', 'NOTHING_TO_SETTLE');
    doc.settled = settled;
    doc.settledAt = settled ? new Date() : null;
    doc.updatedBy = oid(user.id);
    await doc.save();
    return toExpense(doc.toObject(), await lookupMaps([doc]), user);
}
