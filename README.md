# Cards Against Jewels

Cards Against Jewels is a local-first MVP for a real-time adult party card game. It uses a React web app, a Fastify + Socket.IO backend, and in-memory room state so the first playable version does not require Docker, Postgres, Redis, or a cloud account.

## Scripts

```bash
npm install
npm run dev:server
npm run dev:web
npm run test
npm run build
```

By default, the server runs on `http://localhost:3333` and the web app runs on Vite's local dev server.

