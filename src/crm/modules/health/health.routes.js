import { Router } from '../../utils/router.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
    res.json({ ok: true });
});
