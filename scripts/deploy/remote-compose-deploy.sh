#!/usr/bin/env bash
set -Eeuo pipefail

: "${APP_DIR:?APP_DIR is required}"
: "${REPO_URL:?REPO_URL is required}"
: "${RELEASE_REF:?RELEASE_REF is required}"

HEALTH_URL="${HEALTH_URL:-}"
IMAGE_TAG="${IMAGE_TAG:-$RELEASE_REF}"
IMAGE_TAG="${IMAGE_TAG//\//-}"
IMAGE_ARCHIVE="${IMAGE_ARCHIVE:-}"
PREVIOUS_REF=""
PREVIOUS_RELEASE_ENV=""

if [ -n "$IMAGE_ARCHIVE" ]; then
  IMAGE_ARCHIVE="$(realpath "$IMAGE_ARCHIVE")"
fi

compose() {
  if [ -f ".env.release" ]; then
    docker compose --env-file .env.production --env-file .env.release -f docker-compose.prod.yml "$@"
  else
    docker compose --env-file .env.production -f docker-compose.prod.yml "$@"
  fi
}

wait_for_services() {
  local timeout_seconds="$1"
  shift
  local deadline=$((SECONDS + timeout_seconds))
  local service
  local container_id
  local health_status
  local status
  local all_ready

  while [ "$SECONDS" -lt "$deadline" ]; do
    all_ready=1

    for service in "$@"; do
      container_id="$(compose ps -q "$service" 2>/dev/null || true)"

      if [ -z "$container_id" ]; then
        all_ready=0
        break
      fi

      health_status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
      status="$(docker inspect -f '{{.State.Status}}' "$container_id" 2>/dev/null || true)"

      if [ -n "$health_status" ] && [ "$health_status" != "healthy" ]; then
        all_ready=0
        break
      fi

      if [ -z "$health_status" ] && [ "$status" != "running" ]; then
        all_ready=0
        break
      fi
    done

    if [ "$all_ready" -eq 1 ]; then
      return 0
    fi

    sleep 3
  done

  echo "Services did not become ready in ${timeout_seconds}s: $*"
  compose ps

  for service in "$@"; do
    compose logs --tail=80 "$service" || true
  done

  return 1
}

assert_running_image() {
  local service="$1"
  local expected_image="$2"
  local container_id
  local actual_image

  container_id="$(compose ps -q "$service" 2>/dev/null || true)"

  if [ -z "$container_id" ]; then
    echo "Service is not running: $service"
    return 1
  fi

  actual_image="$(docker inspect -f '{{.Config.Image}}' "$container_id")"
  echo "$service is running image: $actual_image"

  if [ "$actual_image" != "$expected_image" ]; then
    echo "$service is running the wrong image. Expected: $expected_image"
    return 1
  fi
}

rollback() {
  trap - ERR
  set +e

  echo "Deploy failed. Rolling back to previous ref..."

  if [ -n "$PREVIOUS_REF" ]; then
    cd "$APP_DIR"
    git checkout "$PREVIOUS_REF"

    if [ -n "$PREVIOUS_RELEASE_ENV" ] && [ -f "$PREVIOUS_RELEASE_ENV" ]; then
      cp "$PREVIOUS_RELEASE_ENV" .env.release
    else
      rm -f .env.release
    fi

    compose up -d --force-recreate server web
    wait_for_services 240 server web || true
    compose ps
  fi

  exit 1
}

trap rollback ERR

if [ ! -d "$APP_DIR/.git" ]; then
  mkdir -p "$(dirname "$APP_DIR")"
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
PREVIOUS_REF="$(git rev-parse HEAD 2>/dev/null || true)"

if [ -f ".env.release" ]; then
  PREVIOUS_RELEASE_ENV="$(mktemp)"
  cp .env.release "$PREVIOUS_RELEASE_ENV"
fi

git fetch --all --prune
git checkout "$RELEASE_REF"
git reset --hard "$RELEASE_REF"

if [ ! -f ".env.production" ]; then
  echo "Missing $APP_DIR/.env.production"
  echo "Create it from .env.production.example before deploying."
  exit 1
fi

cat > .env.release <<EOF
SERVER_IMAGE=cards-against-jewels-server:${IMAGE_TAG}
WEB_IMAGE=cards-against-jewels-web:${IMAGE_TAG}
EOF

SERVER_IMAGE="cards-against-jewels-server:${IMAGE_TAG}"
WEB_IMAGE="cards-against-jewels-web:${IMAGE_TAG}"

if [ -n "$IMAGE_ARCHIVE" ]; then
  docker load -i "$IMAGE_ARCHIVE"
fi

docker image inspect "$SERVER_IMAGE" "$WEB_IMAGE" >/dev/null

compose up -d postgres
wait_for_services 180 postgres

# Rollback only restores containers. Keep migrations backward-compatible with
# the previous app version, or use an explicit database rollback strategy.
compose run --rm server npm run db:deploy --workspace @cards-against-jewels/server

compose up -d --force-recreate server web
wait_for_services 240 server web

assert_running_image server "$SERVER_IMAGE"
assert_running_image web "$WEB_IMAGE"

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
  false
fi

trap - ERR
echo "Deploy succeeded without external health check."
