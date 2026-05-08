# Docker

This project has one multi-stage `Dockerfile` with two runnable targets:

- `server`: Node/Fastify/Socket.IO API
- `web`: Nginx serving the Vite build

## Build Images

Backend:

```bash
docker build -t cards-against-jewels-server --target server .
```

Frontend:

```bash
docker build \
  --target web \
  --build-arg VITE_SERVER_URL=https://api.example.com \
  --build-arg VITE_DISCORD_CLIENT_ID= \
  -t cards-against-jewels-web .
```

## Run With Compose

For local Docker development:

```bash
docker compose up --build
```

Then run migrations and the first seed:

```bash
docker compose run --rm server npm run db:deploy --workspace @cards-against-jewels/server
docker compose run --rm server npm run db:seed --workspace @cards-against-jewels/server
```

For production on a VPS, use:

```bash
cp .env.production.example .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm server npm run db:deploy --workspace @cards-against-jewels/server
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm server npm run db:seed --workspace @cards-against-jewels/server
```

The web container is exposed on:

```txt
http://localhost:8080
```

The API is exposed locally on:

```txt
http://localhost:3333
```

## VPS Without Registry

Build locally:

```bash
docker build -t cards-against-jewels-server --target server .
docker build --target web --build-arg VITE_SERVER_URL=https://api.example.com -t cards-against-jewels-web .
```

Export:

```bash
docker save cards-against-jewels-server cards-against-jewels-web | gzip > cards-against-jewels-images.tar.gz
```

Upload:

```bash
scp cards-against-jewels-images.tar.gz user@your-vps:/tmp/
```

Load on the VPS:

```bash
gunzip -c /tmp/cards-against-jewels-images.tar.gz | docker load
```

Run the API:

```bash
docker run -d \
  --name cards-against-jewels-server \
  --restart unless-stopped \
  --env-file /var/www/cards-against-jewels/server.env \
  -p 127.0.0.1:3333:3333 \
  cards-against-jewels-server
```

Run the web image:

```bash
docker run -d \
  --name cards-against-jewels-web \
  --restart unless-stopped \
  -p 127.0.0.1:8080:80 \
  cards-against-jewels-web
```

Put Nginx in front of both containers and proxy WebSocket traffic to `127.0.0.1:3333`.

## Versioning

Do not commit built Docker images. Commit the `Dockerfile`, `.dockerignore`, Compose file, and source code. Images are build artifacts. Normally you build them from a Git commit and tag them with the commit SHA:

```bash
docker build -t cards-against-jewels-server:$(git rev-parse --short HEAD) --target server .
```
