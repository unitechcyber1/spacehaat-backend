import { Router } from '../../utils/router.js';
import { validateBody } from '../../middleware/validate.js';
import { requirePermission, requireRole } from '../auth/auth.middleware.js';
import { PERMISSIONS } from '../auth/permissions.js';
import {
    CategoryCreateSchema,
    CategoryUpdateSchema,
    ExpenseCreateSchema,
    ExpenseSettleSchema,
    ExpenseUpdateSchema,
} from './expenses.schema.js';
import {
    createCategory,
    createExpense,
    deleteExpense,
    expenseSummary,
    getExpense,
    listCategories,
    listExpensePeople,
    listExpenses,
    settleExpense,
    updateCategory,
    updateExpense,
} from './expenses.service.js';

/**
 * Office expenses. Admins see and manage everything; staff with `expenses:write` add their own
 * expenses and see only those (the service scopes every query).
 */
export const expensesRouter = Router();

const canUse = requirePermission(PERMISSIONS.EXPENSES_WRITE);
const adminOnly = requireRole('admin');
const q = (req) => Object.fromEntries(Object.entries(req.query).filter(([, v]) => typeof v === 'string'));

expensesRouter.get('/expenses', canUse, async (req, res) => {
    res.json(await listExpenses(req.user, q(req)));
});

expensesRouter.get('/expenses/summary', canUse, async (req, res) => {
    res.json(await expenseSummary(req.user, q(req)));
});

expensesRouter.get('/expenses/people', adminOnly, async (_req, res) => {
    res.json(await listExpensePeople());
});

expensesRouter.get('/expense-categories', canUse, async (req, res) => {
    const includeArchived = req.query.all === '1' && req.user.role === 'admin';
    res.json({ items: await listCategories({ includeArchived }) });
});

expensesRouter.post('/expense-categories', adminOnly, validateBody(CategoryCreateSchema), async (req, res) => {
    res.status(201).json({ item: await createCategory(req.body, req.user) });
});

expensesRouter.patch('/expense-categories/:id', adminOnly, validateBody(CategoryUpdateSchema), async (req, res) => {
    res.json({ item: await updateCategory(String(req.params.id), req.body) });
});

expensesRouter.get('/expenses/:id', canUse, async (req, res) => {
    res.json({ item: await getExpense(req.user, String(req.params.id)) });
});

expensesRouter.post('/expenses', canUse, validateBody(ExpenseCreateSchema), async (req, res) => {
    res.status(201).json({ item: await createExpense(req.user, req.body) });
});

expensesRouter.patch('/expenses/:id', canUse, validateBody(ExpenseUpdateSchema), async (req, res) => {
    res.json({ item: await updateExpense(req.user, String(req.params.id), req.body) });
});

expensesRouter.post('/expenses/:id/settle', adminOnly, validateBody(ExpenseSettleSchema), async (req, res) => {
    res.json({ item: await settleExpense(req.user, String(req.params.id), req.body.settled) });
});

expensesRouter.delete('/expenses/:id', canUse, async (req, res) => {
    await deleteExpense(req.user, String(req.params.id));
    res.json({ ok: true });
});
