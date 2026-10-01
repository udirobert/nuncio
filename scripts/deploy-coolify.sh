#!/bin/bash
# Deploy a Coolify-managed Docker service via image rebuild + container swap.
#
# Parameterized — no hardcoded hosts, containers, or URLs. All deployment
# identity comes from environment (see Usage). Personal defaults live in the
# gitignored scripts/deploy-nuncio.sh wrapper, which sets these vars and execs
# this script.
#
# Flow:
#   0. Pre-flight: env file sanity, Traefik health, run-helper presence
#   1. rsync code to REMOTE_DIR (Docker build context)
#   2. Build Docker image (IMAGE) on the server (detached screen session)
#   3. Stop + remove old container, start new one with same env/labels/network
#   4. Layered health check: in-container app → public edge → webhook route
#
# Guardrails (added 2026-10-01 after the host-node outage):
#   - Fail fast if ENV_FILE is missing or has fewer than ENV_MIN_VARS vars
#     (/tmp is wiped on reboot — a thin file boots a container with no secrets).
#   - Fail fast if coolify-proxy (Traefik) is not running|healthy — without it,
#     every Host()-routed site 521s and the health check would blame the app.
#   - Build success is proven by image freshness, not log grep (Next.js prints
#     "error" in normal output; grep false-positives).
#   - Rollback tag of the outgoing image is taken before the swap.
#
# Server-side prerequisites (set up once per host, see docs/DEPLOY.md):
#   - Passwordless sudo for docker
#   - ${ENV_FILE} (env vars, one KEY=VALUE per line)
#   - ${RUN_HELPER} (container start script with Traefik labels; keep a
#     reboot-surviving copy at ~/nuncio-run.py — /tmp is wiped on reboot)
#
# Usage:
#   NUNCIO_SSH_HOST=nuncio-vultr \
#   NUNCIO_REMOTE_DIR=/opt/nuncio \
#   NUNCIO_CONTAINER=iv3o80fe9jgfa30t88kud4wp-012325559756 \
#   NUNCIO_IMAGE=nuncio:latest \
#   NUNCIO_PUBLIC_URL=https://nuncio.persidian.com \
#     scripts/deploy-coolify.sh
#
#   Optional: NUNCIO_ENV_FILE, NUNCIO_RUN_HELPER, NUNCIO_ENV_MIN_VARS (default 30)

set -euo pipefail

REMOTE="${NUNCIO_SSH_HOST:?set NUNCIO_SSH_HOST (e.g. nuncio-vultr)}"
REMOTE_DIR="${NUNCIO_REMOTE_DIR:?set NUNCIO_REMOTE_DIR (e.g. /opt/nuncio)}"
CONTAINER="${NUNCIO_CONTAINER:?set NUNCIO_CONTAINER}"
IMAGE="${NUNCIO_IMAGE:?set NUNCIO_IMAGE (e.g. nuncio:latest)}"
PUBLIC_URL="${NUNCIO_PUBLIC_URL:?set NUNCIO_PUBLIC_URL (e.g. https://nuncio.persidian.com)}"
ENV_FILE="${NUNCIO_ENV_FILE:-/tmp/nuncio-env.txt}"
RUN_HELPER="${NUNCIO_RUN_HELPER:-/tmp/nuncio-run.py}"
# Reboot-surviving canonical copy of the run helper (/tmp is wiped on reboot).
RUN_HELPER_HOME="${NUNCIO_RUN_HELPER_HOME:-~/nuncio-run.py}"
ENV_MIN_VARS="${NUNCIO_ENV_MIN_VARS:-30}"

sshq() { ssh -o ConnectTimeout=10 "${REMOTE}" "$@"; }

PUBLIC_HOST="${NUNCIO_PUBLIC_HOST:-$(echo "${PUBLIC_URL}" | sed -E 's#https?://([^/]+).*#\1#')}"
BUILD_SESSION="${NUNCIO_BUILD_SESSION:-coolifybuild}"
BUILD_LOG="${NUNCIO_BUILD_LOG:-/tmp/coolify-docker-build.log}"

echo "→ [0/4] Pre-flight checks..."

# Guard 1: server env file must exist and look sane. /tmp is wiped on reboot,
# so a missing/thin file means regenerate-from-container first, not deploy.
ENV_COUNT=$(sshq "wc -l < ${ENV_FILE} 2>/dev/null || echo 0" | tr -d '[:space:]')
if ! [[ "${ENV_COUNT}" =~ ^[0-9]+$ ]] || [ "${ENV_COUNT}" -lt "${ENV_MIN_VARS}" ]; then
  echo "✗ ${ENV_FILE} on ${REMOTE} has ${ENV_COUNT} lines (need ≥${ENV_MIN_VARS})."
  echo "  /tmp is wiped on reboot — regenerate before deploying:"
  echo "  ssh ${REMOTE} 'sudo docker inspect ${CONTAINER} --format \"{{range .Config.Env}}{{println .}}{{end}}\" > ${ENV_FILE} && wc -l ${ENV_FILE}'"
  exit 1
fi
echo "   ✓ env file: ${ENV_COUNT} vars"

# Guard 2: Traefik must be up. All Host()-routed sites 521 without it, and the
# health check below would blame the app for a proxy outage.
PROXY_STATE=$(sshq "sudo docker inspect coolify-proxy --format '{{.State.Status}}|{{.State.Health.Status}}' 2>/dev/null || echo missing" | tr -d '[:space:]')
if [ "${PROXY_STATE}" != "running|healthy" ]; then
  echo "✗ coolify-proxy state: ${PROXY_STATE} (need running|healthy)."
  echo "  Likely port :80 conflict with host nginx — see docs/DEPLOY.md (2026-10-01 outage)."
  echo "  Fix: free :80/:443, then: sudo docker compose -f /data/coolify/proxy/docker-compose.yml up -d"
  exit 1
fi
echo "   ✓ coolify-proxy: ${PROXY_STATE}"

# Guard 3: run helper must exist (canonical copy survives reboot at ${RUN_HELPER_HOME}).
if ! sshq "test -f ${RUN_HELPER} || test -f ${RUN_HELPER_HOME}" 2>/dev/null; then
  echo "✗ ${RUN_HELPER} missing on ${REMOTE} (and no ${RUN_HELPER_HOME} fallback)."
  exit 1
fi
echo "   ✓ run helper present"

echo "→ [1/4] Syncing code to ${REMOTE}:${REMOTE_DIR}..."
rsync -az --delete \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='.env' --exclude='.env.*' \
  --exclude='*.log' \
  --exclude='pnpm-lock.yaml' \
  --exclude='.data' \
  --exclude='.DS_Store' \
  ./ "${REMOTE}:${REMOTE_DIR}/"

echo "→ [2/4] Building Docker image ${IMAGE} on remote..."
# Build in a detached screen session so SSH doesn't hang on the long build.
ssh -o ConnectTimeout=10 "${REMOTE}" "cd ${REMOTE_DIR} && \
  sudo screen -dmS ${BUILD_SESSION} bash -c 'sudo docker build -t ${IMAGE} . > ${BUILD_LOG} 2>&1' && \
  echo 'Build started in screen session'"

# Poll until the build finishes (up to 8 minutes — Next.js builds run long).
echo "   Waiting for build to complete..."
BUILD_DONE=false
for i in $(seq 1 48); do
  sleep 10
  DONE=$(ssh -o ConnectTimeout=5 "${REMOTE}" "sudo screen -ls 2>/dev/null | grep -q ${BUILD_SESSION} && echo 'running' || echo 'done'" 2>/dev/null || echo "unknown")
  if [ "${DONE}" = "done" ]; then
    echo "   Build session ended after ~$((i * 10))s"
    BUILD_DONE=true
    break
  fi
  if [ $((i % 6)) -eq 0 ]; then
    ssh -o ConnectTimeout=5 "${REMOTE}" "tail -n 2 ${BUILD_LOG} 2>/dev/null | strings | cut -c1-120" || true
  else
    printf "."
  fi
done
echo ""
if [ "${BUILD_DONE}" != true ]; then
  echo "✗ Build still running after 8 min — check manually:"
  echo "  ssh ${REMOTE} 'tail -n 20 ${BUILD_LOG} | strings'"
  exit 1
fi

# Check for build failure by image freshness, not log grep (Next.js prints
# "error" in normal output; grep false-positives). The build must have
# produced a new image within the last 15 minutes.
IMAGE_CREATED=$(ssh -o ConnectTimeout=5 "${REMOTE}" "sudo docker inspect ${IMAGE} --format '{{.Created}}' 2>/dev/null" || echo "")
if [ -z "${IMAGE_CREATED}" ]; then
  echo "✗ Image ${IMAGE} not found after build. Last 20 lines of log:"
  ssh -o ConnectTimeout=5 "${REMOTE}" "tail -20 ${BUILD_LOG} 2>/dev/null | strings"
  exit 1
fi
IMAGE_AGE_S=$(( $(date +%s) - $(date -d "${IMAGE_CREATED}" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "${IMAGE_CREATED%%.*}" +%s 2>/dev/null || echo 0) ))
if [ "${IMAGE_AGE_S}" -gt 900 ] 2>/dev/null; then
  echo "✗ Image ${IMAGE} is stale (created ${IMAGE_CREATED}) — build likely failed. Log tail:"
  ssh -o ConnectTimeout=5 "${REMOTE}" "tail -20 ${BUILD_LOG} 2>/dev/null | strings"
  exit 1
fi
echo "   ✓ Image ${IMAGE} built successfully (created ${IMAGE_CREATED})"

echo "→ [3/4] Swapping container..."
# Tag the outgoing image for rollback before touching anything.
ssh -o ConnectTimeout=10 "${REMOTE}" \
  "sudo docker tag ${IMAGE} ${IMAGE%:*}:previous-deploy 2>/dev/null; echo 'rollback tag set'"
# Stop and remove the old container.
ssh -o ConnectTimeout=10 "${REMOTE}" \
  "sudo docker stop ${CONTAINER} 2>/dev/null; sudo docker rm ${CONTAINER} 2>/dev/null; echo 'old container removed'"

# Start the new container using the Python helper (avoids shell escaping issues
# with Traefik's Host(`...`) backtick rules). See docs/DEPLOY.md for setup.
# Prefer /tmp copy, fall back to the reboot-surviving ${RUN_HELPER_HOME}.
ssh -o ConnectTimeout=10 "${REMOTE}" \
  "if [ -f ${RUN_HELPER} ]; then python3 ${RUN_HELPER}; elif [ -f ${RUN_HELPER_HOME} ]; then cp ${RUN_HELPER_HOME} ${RUN_HELPER} && python3 ${RUN_HELPER}; else echo '✗ no run helper — see docs/DEPLOY.md'; exit 1; fi"

# Wait for the container to boot.
sleep 8

echo "→ [4/4] Health check (layered: app → proxy → edge)..."
# Layer 1: app inside the container (distinguishes app crash from proxy failure).
APP_HEALTH=$(ssh -o ConnectTimeout=10 "${REMOTE}" "sudo docker exec ${CONTAINER} sh -c 'wget -q -O /dev/null --timeout=10 http://127.0.0.1:3000/ && echo 200 || echo FAIL' 2>/dev/null" || echo "SSH_FAIL")
echo "   app (in-container :3000): ${APP_HEALTH}"
# Layer 2: public edge.
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' "${PUBLIC_URL}/" 2>/dev/null || echo "000")
if [ "${HTTP_CODE}" != "200" ]; then
  sleep 15  # Traefik needs a moment to re-register the new container IP.
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' "${PUBLIC_URL}/" 2>/dev/null || echo "000")
fi
echo "   edge (${PUBLIC_URL}/): ${HTTP_CODE}"
if [ "${HTTP_CODE}" = "521" ]; then
  echo "   ✗ 521 = Cloudflare can't reach origin → coolify-proxy is down again, not the app."
elif [ "${HTTP_CODE}" != "200" ]; then
  echo "   ✗ edge ${HTTP_CODE} with app=${APP_HEALTH} — investigate before trusting this deploy."
fi
# Layer 3: scheduling webhook route state (pilot gate visibility).
# 401 = configured + signature-enforced (good). 404 = pilot env missing (untracked).
WEBHOOK_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "${PUBLIC_URL}/api/scheduling/webhooks/calcom" -H 'Content-Type: application/json' -d '{}' 2>/dev/null || echo "000")
echo "   webhook route (unsigned POST): ${WEBHOOK_CODE} (401=configured, 404=pilot env missing)"

# Verify the auth redirect fix is live.
REDIRECT=$(curl -s -o /dev/null -w '%{redirect_url}' "${PUBLIC_URL}/api/auth/verify?token=test" 2>/dev/null)
if echo "${REDIRECT}" | grep -q "${PUBLIC_HOST}"; then
  echo "✓ Auth redirect: ${REDIRECT}"
else
  echo "⚠ Auth redirect: ${REDIRECT} (expected ${PUBLIC_HOST})"
fi

echo ""
echo "✓ Deploy complete — ${PUBLIC_URL}"
