import { timingSafeEqual } from 'crypto'
import { rateLimit } from 'express-rate-limit'

// The website renders pages on the same server, so all its API calls share one IP.
// It sends INTERNAL_API_TOKEN so crawls of thousands of pages don't hit the per-IP limit.
function isInternalRequest(req) {
	const internalToken = Buffer.from(process.env.INTERNAL_API_TOKEN?.trim() || '')
	const sent = Buffer.from(String(req.get('x-internal-token') || ''))
	return internalToken.length > 0 && sent.length === internalToken.length && timingSafeEqual(sent, internalToken)
}

export const limiter = rateLimit({
	windowMs: 1 * 60 * 1000, // 1 minutes
	limit: 1000, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
	// CORS preflight must not be rate-limited or the browser sees a response without CORS headers
	skip: (req) => req.method === 'OPTIONS' || isInternalRequest(req),
	// store: ... , // Use an external store for consistency across multiple server instances.
})
