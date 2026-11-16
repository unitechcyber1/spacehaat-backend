import { Router } from 'express';
import mongoose from 'mongoose';
import models from '../../models/index.js';

/**
 * "Verified on <date>" badge for coworking spaces and PGs, controlled by the team in the admin.
 *
 *   PUT /api/admin/listing-verification/:kind/:id   kind = workspace | pg
 *     { method: 'call' | 'visit' | 'documents' }  → verified today, by the logged-in admin
 *     { remove: true }                             → badge removed
 *
 * PGs also keep their `verified` flag in step, so the website's "Verified" filter matches the badge.
 */
const { WorkSpace, PG } = models;
const METHODS = ['call', 'visit', 'documents'];
const router = Router();

router.put('/listing-verification/:kind/:id', async (req, res, next) => {
    try {
        const { kind, id } = req.params;
        const Model = kind === 'workspace' ? WorkSpace : kind === 'pg' ? PG : null;
        if (!Model) return res.status(400).json({ message: 'kind must be workspace or pg' });
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid id' });

        const remove = req.body?.remove === true;
        const method = String(req.body?.method || '').trim();
        if (!remove && !METHODS.includes(method)) {
            return res.status(400).json({ message: `method must be one of: ${METHODS.join(', ')}` });
        }

        const by = String(req.user?.name || req.user?.email || 'admin').trim().slice(0, 120);
        const update = remove
            ? { $unset: { verified_at: '', verified_by: '', verified_method: '' }, ...(kind === 'pg' ? { $set: { verified: false } } : {}) }
            : { $set: { verified_at: new Date(), verified_by: by, verified_method: method, ...(kind === 'pg' ? { verified: true } : {}) } };

        const doc = await Model.findByIdAndUpdate(id, update, { new: true }).select('verified_at verified_by verified_method').lean();
        if (!doc) return res.status(404).json({ message: 'Listing not found' });
        res.status(200).json({
            message: remove ? 'Verification removed' : 'Marked as verified',
            data: { verified_at: doc.verified_at || null, verified_by: doc.verified_by || '', verified_method: doc.verified_method || '' },
        });
    } catch (error) {
        next(error);
    }
});

export default router;
