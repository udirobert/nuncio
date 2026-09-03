#!/bin/bash
# Backwards-compatible wrapper — the VPS uses Docker + Coolify-style Traefik labels.
# See scripts/deploy-vps.sh for the canonical deploy script.
set -euo pipefail
exec "$(dirname "$0")/deploy-vps.sh" "$@"
