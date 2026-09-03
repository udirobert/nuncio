#!/bin/bash
set -euo pipefail

# Deploy nuncio on the production VPS using Docker + Coolify-style Traefik labels.
#
# Intended to run directly on the server, or piped over SSH:
#   ssh nuncio-vultr 'bash -s' < scripts/deploy-vps.sh
#
# Environment overrides (all have sensible defaults for the current server):
#   NUNCIO_DIR              source directory on the server (default: /opt/nuncio)
#   NUNCIO_ENV_FILE         env file passed to the container (default: /tmp/nuncio-env.txt)
#   NUNCIO_IMAGE            image tag to build/deploy (default: nuncio:latest)
#   NUNCIO_PREVIOUS_IMAGE   rollback tag (default: nuncio:previous)
#   NUNCIO_CONTAINER_NAME   container name Coolify expects (default: iv3o80fe9jgfa30t88kud4wp-012325559756)
#   NUNCIO_NETWORK          Docker network (default: coolify)
#   NUNCIO_HOST             public host (default: nuncio.persidian.com)
#   NUNCIO_TRAEFIK_UUID     router/service uuid (default: iv3o80fe9jgfa30t88kud4wp)
#   NUNCIO_SMOKE_URL        url for smoke checks (default: https://<NUNCIO_HOST>)

NUNCIO_DIR="${NUNCIO_DIR:-/opt/nuncio}"
NUNCIO_ENV_FILE="${NUNCIO_ENV_FILE:-/tmp/nuncio-env.txt}"
NUNCIO_IMAGE="${NUNCIO_IMAGE:-nuncio:latest}"
NUNCIO_PREVIOUS_IMAGE="${NUNCIO_PREVIOUS_IMAGE:-nuncio:previous}"
NUNCIO_CONTAINER_NAME="${NUNCIO_CONTAINER_NAME:-iv3o80fe9jgfa30t88kud4wp-012325559756}"
NUNCIO_NETWORK="${NUNCIO_NETWORK:-coolify}"
NUNCIO_HOST="${NUNCIO_HOST:-nuncio.persidian.com}"
NUNCIO_TRAEFIK_UUID="${NUNCIO_TRAEFIK_UUID:-iv3o80fe9jgfa30t88kud4wp}"
NUNCIO_SMOKE_URL="${NUNCIO_SMOKE_URL:-https://${NUNCIO_HOST}}"

if [ ! -f "$NUNCIO_ENV_FILE" ]; then
  echo "Error: env file not found: $NUNCIO_ENV_FILE" >&2
  exit 1
fi

cd "$NUNCIO_DIR"

echo "Current source commit: $(git rev-parse HEAD 2>/dev/null || echo 'unknown')"

# Tag the currently running production image so we can roll back if smoke fails.
if docker image inspect "$NUNCIO_IMAGE" >/dev/null 2>&1; then
  echo "Tagging current $NUNCIO_IMAGE as $NUNCIO_PREVIOUS_IMAGE for rollback..."
  docker tag "$NUNCIO_IMAGE" "$NUNCIO_PREVIOUS_IMAGE"
else
  echo "No existing $NUNCIO_IMAGE found; no rollback image will be available."
fi

echo "Fetching latest main into $NUNCIO_DIR..."
git fetch origin main --depth=1
git reset --hard origin/main

echo "New source commit: $(git rev-parse HEAD)"

echo "Building $NUNCIO_IMAGE..."
docker build -t "$NUNCIO_IMAGE" .

run_container() {
  local image="$1"

  echo "Stopping/removing any existing container..."
  docker stop "$NUNCIO_CONTAINER_NAME" 2>/dev/null || true
  docker rm "$NUNCIO_CONTAINER_NAME" 2>/dev/null || true

  echo "Starting new container from $image..."

  local env_args=()
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"   # trim leading whitespace
    line="${line%"${line##*[![:space:]]}"}"   # trim trailing whitespace
    [ -z "$line" ] && continue
    [[ "$line" =~ ^# ]] && continue
    [[ "$line" == *=* ]] || continue
    env_args+=("-e" "$line")
  done < "$NUNCIO_ENV_FILE"

  docker run -d \
    --name "$NUNCIO_CONTAINER_NAME" \
    --network "$NUNCIO_NETWORK" \
    --restart unless-stopped \
    --label traefik.enable=true \
    --label traefik.http.middlewares.gzip.compress=true \
    --label traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https \
    --label "traefik.http.routers.http-0-$NUNCIO_TRAEFIK_UUID.entrypoints=http" \
    --label "traefik.http.routers.http-0-$NUNCIO_TRAEFIK_UUID.middlewares=redirect-to-https" \
    --label "traefik.http.routers.http-0-$NUNCIO_TRAEFIK_UUID.rule=Host(\`$NUNCIO_HOST\`) && PathPrefix(\`/\`)" \
    --label "traefik.http.routers.http-0-$NUNCIO_TRAEFIK_UUID.service=http-0-$NUNCIO_TRAEFIK_UUID" \
    --label "traefik.http.routers.https-0-$NUNCIO_TRAEFIK_UUID.entrypoints=https" \
    --label "traefik.http.routers.https-0-$NUNCIO_TRAEFIK_UUID.middlewares=gzip" \
    --label "traefik.http.routers.https-0-$NUNCIO_TRAEFIK_UUID.rule=Host(\`$NUNCIO_HOST\`) && PathPrefix(\`/\`)" \
    --label "traefik.http.routers.https-0-$NUNCIO_TRAEFIK_UUID.service=https-0-$NUNCIO_TRAEFIK_UUID" \
    --label traefik.http.routers.https-0-$NUNCIO_TRAEFIK_UUID.tls=true \
    --label traefik.http.routers.https-0-$NUNCIO_TRAEFIK_UUID.tls.certresolver=letsencrypt \
    --label traefik.http.services.http-0-$NUNCIO_TRAEFIK_UUID.loadbalancer.server.port=3000 \
    --label traefik.http.services.https-0-$NUNCIO_TRAEFIK_UUID.loadbalancer.server.port=3000 \
    "${env_args[@]}" \
    "$image"
}

run_container "$NUNCIO_IMAGE"

smoke_ok=false
for i in $(seq 1 12); do
  sleep 5
  homepage_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$NUNCIO_SMOKE_URL" || echo "000")
  enrich_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 -X POST -H "Content-Type: application/json" -d '{"urls":[]}' "$NUNCIO_SMOKE_URL/api/enrich" || echo "000")
  echo "Smoke check $i: homepage=$homepage_code enrich=$enrich_code"
  if [ "$homepage_code" = "200" ] && [ "$enrich_code" = "400" ]; then
    smoke_ok=true
    break
  fi
done

if [ "$smoke_ok" != true ]; then
  echo "Smoke checks failed. Rolling back to $NUNCIO_PREVIOUS_IMAGE..." >&2
  if docker image inspect "$NUNCIO_PREVIOUS_IMAGE" >/dev/null 2>&1; then
    run_container "$NUNCIO_PREVIOUS_IMAGE"
    echo "Rolled back to $NUNCIO_PREVIOUS_IMAGE."
  else
    echo "No rollback image available. Container may be down." >&2
  fi
  exit 1
fi

# Clean up old untagged/dangling images to avoid disk bloat.
docker image prune -f >/dev/null 2>&1 || true

echo "Deploy successful. Running container:"
docker ps --filter "name=$NUNCIO_CONTAINER_NAME" --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
