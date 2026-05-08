# VPS Deploy

Recommended production setup:

```txt
Internet
  -> Nginx on Ubuntu host
    -> 127.0.0.1:8080  web container
    -> 127.0.0.1:3333  server container
      -> postgres container on Docker internal network
```

This keeps Node, Nginx static serving, and PostgreSQL reproducible through Docker Compose. The host only needs Docker, Nginx, Certbot, Git, and SSH.

## One-Time VPS Setup

Install Docker, Nginx, Certbot, and Git on Ubuntu:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg git nginx certbot python3-certbot-nginx
```

Install Docker using Docker's official Ubuntu instructions, then confirm:

```bash
docker --version
docker compose version
```

Clone the repository:

```bash
sudo mkdir -p /opt/cards-against-jewels
sudo chown -R "$USER":"$USER" /opt/cards-against-jewels
git clone <REPO_URL> /opt/cards-against-jewels
cd /opt/cards-against-jewels
```

Create production variables:

```bash
cp .env.production.example .env.production
nano .env.production
```

Use a strong password and make `DATABASE_URL` point to the Compose service name `postgres`:

```env
POSTGRES_DB=caj
POSTGRES_USER=caj
POSTGRES_PASSWORD=change_me
DATABASE_URL=postgresql://caj:change_me@postgres:5432/caj?schema=public
VITE_SERVER_URL=https://api.example.com
VITE_DISCORD_CLIENT_ID=
```

If the database password contains URL-reserved characters, encode them in `DATABASE_URL`.

## First Deploy

Build and start everything:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Run migrations:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm server npm run db:deploy --workspace @cards-against-jewels/server
```

Seed cards once for a new database:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm server npm run db:seed --workspace @cards-against-jewels/server
```

The seed data itself is intentionally not versioned. Before running the seed, create this local file on the VPS:

```txt
apps/server/prisma/seed-data/br-deck.ts
```

Use `apps/server/prisma/seed-data.example.ts` as the format reference.

Check containers:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

## GitHub Actions Deploy

The workflow `.github/workflows/deploy-vps.yml` runs CI and then SSHes into the VPS. The VPS pulls the requested Git commit, builds images with Docker Compose, applies Prisma migrations, starts containers, and checks health. If health fails, it checks out the previous commit and restarts server/web.

Required GitHub Secrets:

```txt
VPS_HOST
VPS_USER
VPS_SSH_KEY
REPO_URL
HEALTH_URL
```

Optional:

```txt
VPS_PORT
VPS_PATH
```

Defaults:

```txt
VPS_PORT=22
VPS_PATH=/opt/cards-against-jewels
```

`REPO_URL` must be cloneable from the VPS. For private repositories, use an SSH deploy key on the VPS or an HTTPS token URL stored as a GitHub secret.

`HEALTH_URL` should be:

```txt
https://api.example.com/health
```

## Nginx

Frontend vhost:

```nginx
server {
  server_name jogo.example.com;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

API vhost with Socket.IO/WebSocket support:

```nginx
server {
  server_name api.example.com;

  location / {
    proxy_pass http://127.0.0.1:3333;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Enable HTTPS:

```bash
sudo certbot --nginx -d jogo.example.com -d api.example.com
```

## Operations

View logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f server
```

Restart:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml restart server web
```

Update manually:

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm server npm run db:deploy --workspace @cards-against-jewels/server
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```
