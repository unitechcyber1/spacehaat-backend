# WebSocket (Socket.IO) – Production Deployment

## 1. Environment variables

Add to your production `.env`:

```env
# Frontend origin(s) that may connect to Socket.IO (comma-separated if multiple).
# Example: https://app.cofynd.com or https://app.cofynd.com,https://admin.cofynd.com
FRONTEND_URL=https://your-crm-frontend-domain.com

# Optional: public API base URL (used for CSP). Example: https://api.cofynd.com
API_URL=https://your-api-domain.com
```

- **FRONTEND_URL** (or **CORS_ORIGIN**): Required so the browser allows the WebSocket connection from your CRM frontend. Without it, Socket.IO falls back to `*` (works but less secure).
- **API_URL**: Optional; used so the backend’s CSP allows `wss://` and `https://` to your API domain.

## 2. Reverse proxy (Nginx / Apache)

If the Node app runs behind Nginx (or similar), the proxy must support WebSocket upgrade.

**Nginx example:**

```nginx
location /socket.io/ {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://localhost:9000;
}
```

Replace `http://localhost:9000` with your upstream (e.g. `http://127.0.0.1:9000`). Ensure the `location` for your API also forwards the same headers if `/socket.io/` is under a general API `location /`.

## 3. Frontend connection URL

Point the Socket.IO client at your **production API base URL** (same host as your REST API):

```javascript
const API_BASE = 'https://api.cofynd.com'; // or from env
const socket = io(API_BASE, {
  path: '/socket.io',
  transports: ['websocket', 'polling']
});
```

Use **https** in production so the initial request and WebSocket upgrade use TLS.

## 4. Quick check

1. Deploy with `FRONTEND_URL` (and optionally `API_URL`) set.
2. Open the CRM, open a WhatsApp conversation (so the client does `join_conversation`).
3. Send a message (from CRM or from WhatsApp) and confirm the new message appears in the UI without refresh.

If it fails, check browser console for CORS or WebSocket errors and proxy logs for `Upgrade`/`Connection` headers.
