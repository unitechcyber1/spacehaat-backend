import {
    createVirtualOffice,
    deleteVirtualOffice,
    getVirtualOffice,
    listVirtualOffices,
    serializeVo,
    updateVirtualOffice,
    virtualOfficeStats,
} from '../../services/virtual-office-listings.js';

const actorOf = (req) => String(req.user?.name || req.user?.email || req.user?._id || '');

/** Errors with a status (validation, not found) go back as that status; the rest to the error handler. */
function handle(fn) {
    return async (req, res, next) => {
        try {
            await fn(req, res);
        } catch (error) {
            if (error?.status) return res.status(error.status).json({ type: 'Error', code: error.status, message: error.message });
            next(error);
        }
    };
}

export default {
    list: handle(async (req, res) => {
        const data = await listVirtualOffices(req.query);
        res.status(200).json({ message: 'Virtual office list', data: data.items, totalRecords: data.total });
    }),
    stats: handle(async (_req, res) => {
        res.status(200).json({ message: 'Virtual office stats', data: await virtualOfficeStats() });
    }),
    get: handle(async (req, res) => {
        res.status(200).json({ message: 'Virtual office', data: serializeVo(await getVirtualOffice(req.params.id)) });
    }),
    create: handle(async (req, res) => {
        const doc = await createVirtualOffice(req.body, actorOf(req));
        res.status(200).json({ message: 'Virtual office added', data: serializeVo(doc) });
    }),
    update: handle(async (req, res) => {
        const doc = await updateVirtualOffice(req.params.id, req.body, actorOf(req));
        res.status(200).json({ message: 'Virtual office updated', data: serializeVo(doc) });
    }),
    remove: handle(async (req, res) => {
        await deleteVirtualOffice(req.params.id);
        res.status(200).json({ message: 'Virtual office deleted' });
    }),
};
