import { z } from 'zod';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

const receipt = z
    .object({ key: z.string().max(500).default(''), url: z.string().max(1000).default('') })
    .nullable()
    .optional();

const fields = {
    amount: z.coerce.number().positive('Enter an amount').max(10_000_000, 'Amount is too large'),
    date: isoDay,
    categoryId: objectId,
    note: z.string().trim().max(1000).optional().default(''),
    /** Admins only: whose expense it is (a staff user, or anyone by name). Members are always themselves. */
    personUserId: objectId.nullable().optional(),
    personName: z.string().trim().max(120).optional(),
    paidBy: z.enum(['company', 'self', 'other']).default('company'),
    paidByName: z.string().trim().max(120).optional().default(''),
    receipt,
};

export const ExpenseCreateSchema = z.object(fields).superRefine((v, ctx) => {
    if (v.paidBy === 'other' && !v.paidByName) {
        ctx.addIssue({ code: 'custom', path: ['paidByName'], message: 'Who paid?' });
    }
});

export const ExpenseUpdateSchema = z
    .object(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])))
    .refine((data) => Object.keys(data).length > 0, { message: 'No fields to update' });

export const ExpenseSettleSchema = z.object({ settled: z.boolean() });

export const CategoryCreateSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(60),
    icon: z.string().trim().max(60).optional(),
});

export const CategoryUpdateSchema = z
    .object({
        name: z.string().trim().min(1).max(60).optional(),
        icon: z.string().trim().max(60).optional(),
        active: z.boolean().optional(),
        order: z.number().int().min(0).max(10000).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: 'No fields to update' });
