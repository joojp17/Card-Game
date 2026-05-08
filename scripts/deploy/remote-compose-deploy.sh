#!/usr/bin/env bash
set -Eeuo pipefail

: "${APP_DIR:?APP_DIR is required}"
: "${REPO_URL:?REPO_URL is required}"
: "${RELEASE_REF:?RELEASE_REF is required}"

COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"
HEALTH_URL="${HEALTH_URL:-}"
PREVIOUS_REF=""

rollback() {
  echo "Deploy failed. Rolling back to previous ref..."

  if [ -n "$PREVIOUS_REF" ]; then
    cd "$APP_DIR"
    git checkout "$PREVIOUS_REF"
    $COMPOSE up -d --build server web
  fi
}

trap rollback ERR

if [ ! -d "$APP_DIR/.git" ]; then
  mkdir -p "$(dirname "$APP_DIR")"
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
PREVIOUS_REF="$(git rev-parse HEAD 2>/dev/null || true)"

git fetch --all --prune
git checkout "$RELEASE_REF"
git reset --hard "$RELEASE_REF"

if [ ! -f ".env.production" ]; then
  echo "Missing $APP_DIR/.env.production"
  echo "Create it from .env.production.example before deploying."
  exit 1
fi

$COMPOSE build
$COMPOSE up -d postgres
$COMPOSE run --rm server npm run db:deploy --workspace @cards-against-jewels/server
$COMPOSE up -d server web

if [ -n "$HEALTH_URL" ]; then
  for attempt in {1..30}; do
    if curl -fsS "$HEALTH_URL" >/dev/null; then
      trap - ERR
      echo "Deploy succeeded."
      exit 0
    fi

    sleep 2
  done

  echo "Health check failed: $HEALTH_URL"
  exit 1
fi

trap - ERR
echo "Deploy succeeded without external health check."
