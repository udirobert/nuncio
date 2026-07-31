#!/bin/bash
# Start the Genblaze media orchestration worker on the VPS.
set -a
source /opt/nuncio/workers/genblaze/.env
set +a
cd /opt/nuncio/workers/genblaze
pkill -f "uvicorn.*8100" 2>/dev/null
sleep 1
exec .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8100
