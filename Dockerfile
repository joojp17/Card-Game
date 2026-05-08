FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_SERVER_URL=http://localhost:3333
ARG VITE_DISCORD_CLIENT_ID=
ENV VITE_SERVER_URL=$VITE_SERVER_URL
ENV VITE_DISCORD_CLIENT_ID=$VITE_DISCORD_CLIENT_ID

COPY . .
RUN npm ci

RUN npm run db:generate --workspace @cards-against-jewels/server
RUN npm run build

FROM node:22-alpine AS server
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/apps/server/package.json apps/server/package.json
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/server/prisma apps/server/prisma

RUN npm run db:generate --workspace @cards-against-jewels/server

EXPOSE 3333
CMD ["node", "apps/server/dist/server.js"]

FROM nginx:1.27-alpine AS web
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
