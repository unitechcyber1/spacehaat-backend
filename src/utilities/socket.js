import { Server } from 'socket.io';

let io = null;

const ROOM_PREFIX = 'whatsapp:conversation:';

/** Canonical phone for room name: digits only, Indian 10-digit prefixed with 91. */
function canonicalPhoneForRoom(phone) {
    const digits = (phone || '').toString().replace(/\D/g, '');
    if (digits.length === 10 && !digits.startsWith('91')) return '91' + digits;
    return digits || '';
}

/** Allowed CORS origins for Socket.IO (production: set FRONTEND_URL or CORS_ORIGIN in .env). */
function getAllowedOrigins() {
    const env = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || '';
    if (env) {
        return env.split(',').map(s => s.trim()).filter(Boolean);
    }
    return '*';
}

/**
 * Initialize Socket.IO on the HTTP server.
 * Production: set FRONTEND_URL (e.g. https://app.cofynd.com) or CORS_ORIGIN in .env so WebSocket works from your frontend.
 * @param {http.Server} server
 * @returns {Server}
 */
export function initSocket(server) {
    if (io) return io;

    const allowedOrigins = getAllowedOrigins();

    io = new Server(server, {
        cors: {
            origin: allowedOrigins,
            methods: ['GET', 'POST'],
            credentials: true
        },
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        pingTimeout: 20000,
        pingInterval: 25000
    });

    io.on('connection', (socket) => {
        socket.on('join_conversation', (data) => {
            const canonical = canonicalPhoneForRoom(data?.phone);
            if (canonical) {
                socket.join(ROOM_PREFIX + canonical);
            }
        });

        socket.on('leave_conversation', (data) => {
            const canonical = canonicalPhoneForRoom(data?.phone);
            if (canonical) {
                socket.leave(ROOM_PREFIX + canonical);
            }
        });
    });

    return io;
}

/**
 * Get the Socket.IO server instance (after initSocket).
 * @returns {Server|null}
 */
export function getIO() {
    return io;
}

/**
 * Emit a new WhatsApp message to all clients watching this conversation.
 * Call after saving inbound (webhook) or outbound (send) message.
 * @param {string} normalizedPhone - normalized phone (no spaces/dashes)
 * @param {object} messageDoc - message document (phone, direction, message, messageSid, status, createdAt, _id)
 */
export function emitWhatsAppMessage(normalizedPhone, messageDoc) {
    if (!io || !normalizedPhone) return;
    const canonical = canonicalPhoneForRoom(normalizedPhone);
    if (!canonical) return;
    const room = ROOM_PREFIX + canonical;
    const payload = messageDoc?.toObject ? messageDoc.toObject() : { ...messageDoc };
    io.to(room).emit('whatsapp_message', payload);
}
