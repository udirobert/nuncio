#!/bin/bash
set -euo pipefail

# Deploy nuncio to a VPS over SSH.
#
# Usage:
#   NUNCIO_DEPLOY_HOST=1.2.3.4 ./scripts/deploy.sh
#
# Optional env overrides:
#   NUNCIO_DEPLOY_USER    (default: deploy)
#   NUNCIO_DEPLOY_DIR     (default: /opt/nuncio)
#   NUNCIO_DEPLOY_SERVICE (default: nuncio)

HOST="${NUNCIO_DEPLOY_HOST:-}"
USER="${NUNCIO_DEPLOY_USER:-deploy}"
DIR="${NUNCIO_DEPLOY_DIR:-/opt/nuncio}"
SERVICE="${NUNCIO_DEPLOY_SERVICE:-nuncio}"

if [ -z "$HOST" ]; then
  echo "Error: NUNCIO_DEPLOY_HOST is required."
  echo "Example: NUNCIO_DEPLOY_HOST=1.2.3.4 ./scripts/deploy.sh"
  exit 1
fi

echo "Deploying to $USER@$HOST:$DIR ..."

ssh "$USER@$HOST" "
  set -euo pipefail
  cd '$DIR'
  echo 'Pulling latest main...'
  git fetch origin main
  git reset --hard origin/main
  echo 'Installing dependencies...'
  pnpm install --frozen-lockfile
  echo 'Building...'
  pnpm build
  echo 'Restarting service...'
  pm2 restart '$SERVICE'
"

echo "Deploy finished."
