import express from 'express';

/** Express 4 does not forward rejected async handlers to the error middleware; these routes rely on that. */
function forwardRejections(handler) {
    if (typeof handler !== 'function' || handler.length >= 4) return handler;
    return (req, res, next) => {
        const result = handler(req, res, next);
        if (result && typeof result.catch === 'function') result.catch(next);
    };
}

/** express.Router() whose async route handlers report errors through next(). */
export function Router() {
    const router = express.Router();
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
        const register = router[method].bind(router);
        router[method] = (path, ...handlers) => register(path, ...handlers.flat().map(forwardRejections));
    }
    return router;
}
