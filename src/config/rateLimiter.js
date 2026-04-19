import { rateLimit } from 'express-rate-limit'

export const limiter = rateLimit({
	windowMs: 1 * 60 * 1000, // 1 minutes
	limit: 1000, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
	// CORS preflight must not be rate-limited or the browser sees a response without CORS headers
	skip: (req) => req.method === 'OPTIONS',
	// store: ... , // Use an external store for consistency across multiple server instances.
})