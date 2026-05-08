#!/usr/bin/env bash
set -Eeuo pipefail

: "${APP_DIR:?APP_DIR is required}"
: "${RELEASE_SHA:?RELEASE_SHA is required}"
: "${SERVICE_NAME:?SERVICE_NAME is required}"

RELEASES_DIR="$APP_DIR/releases"
UPLOAD="$APP_DIR/uploads/$RELEASE_SHA.tgz"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_SHA"
CURRENT_LINK="$APP_DIR/current"
PREVIOUS_LINK="$APP_DIR/previous"

rollback() {
  echo "Deploy failed. Rolling back..."

  if [ -L "$PREVIOUS_LINK" ] && [ -d "$(readlink -f "$PREVIOUS_LINK")" ]; then
    ln -sfn "$(readlink -f "$PREVIOUS_LINK")" "$CURRENT_LINK"
    sudo systemctl restart "$SERVICE_NAME"
  fi
}

trap rollback ERR

mkdir -p "$RELEASES_DIR" "$APP_DIR/uploads" "$APP_DIR/shared/env"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
tar -xzf "$UPLOAD" -C "$RELEASE_DIR"

cp "$APP_DIR/shared/env/server.env" "$RELEASE_DIR/apps/server/.env"
cp "$APP_DIR/shared/env/web.env" "$RELEASE_DIR/apps/web/.env"

cd "$RELEASE_DIR"
npm ci
npm run db:generate --workspace @cards-against-jewels/server
npm run db:deploy --workspace @cards-against-jewels/server
npm run build

if [ -L "$CURRENT_LINK" ]; then
  ln -sfn "$(readlink -f "$CURRENT_LINK")" "$PREVIOUS_LINK"
fi

ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
sudo systemctl restart "$SERVICE_NAME"

if [ -n "${HEALTH_URL:-}" ]; then
  for attempt in {1..20}; do
    if curl -fsS "$HEALTH_URL" >/dev/null; then
      trap - ERR
      find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d | sort -r | tail -n +6 | xargs -r rm -rf
      echo "Deploy succeeded."
      exit 0
    fi

    sleep 2
  done

  echo "Health check failed: $HEALTH_URL"
  exit 1
fi

trap - ERR
find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d | sort -r | tail -n +6 | xargs -r rm -rf
echo "Deploy succeeded without health check."
