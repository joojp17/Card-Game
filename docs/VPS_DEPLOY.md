# VPS Deploy

This repository ships a GitHub Actions workflow for production deploys to a Linux VPS.

## Expected VPS Layout

Set `VPS_PATH` to the application directory, for example:

```txt
/var/www/cards-against-jewels
```

The workflow creates:

```txt
/var/www/cards-against-jewels/current
/var/www/cards-against-jewels/previous
/var/www/cards-against-jewels/releases/<git-sha>
/var/www/cards-against-jewels/shared/env/server.env
/var/www/cards-against-jewels/shared/env/web.env
```

## GitHub Secrets

Required:

```txt
VPS_HOST
VPS_USER
VPS_SSH_KEY
VPS_PATH
SERVER_ENV
WEB_ENV
HEALTH_URL
```

Optional:

```txt
VPS_PORT
VPS_SERVICE_NAME
```

`SERVER_ENV` should contain the full contents of `apps/server/.env` for production:

```env
PORT=3333
HOST=127.0.0.1
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/caj?schema=public"
```

`WEB_ENV` should contain:

```env
VITE_SERVER_URL=https://api.example.com
VITE_DISCORD_CLIENT_ID=
```

`HEALTH_URL` should point to the backend health endpoint:

```txt
https://api.example.com/health
```

## systemd Service

Create `/etc/systemd/system/cards-against-jewels.service`:

```ini
[Unit]
Description=Cards Against Jewels API
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/cards-against-jewels/current/apps/server
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable cards-against-jewels
```

The GitHub workflow restarts this service after each deploy. If `HEALTH_URL` fails, it points `current` back to `previous` and restarts the service again.

The deploy user must be able to run this without a password:

```bash
sudo systemctl restart cards-against-jewels
```

Run the seed manually the first time you create an empty database:

```bash
cd /var/www/cards-against-jewels/current
npm run db:seed --workspace @cards-against-jewels/server
```

## Nginx

Serve the frontend from:

```txt
/var/www/cards-against-jewels/current/apps/web/dist
```

Proxy the backend to:

```txt
http://127.0.0.1:3333
```

Remember WebSocket headers for Socket.IO:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header Host $host;
```
