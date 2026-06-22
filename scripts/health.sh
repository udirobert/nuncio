#!/bin/bash
# nuncio health check — verifies the server is serving correctly
# Usage: scripts/health.sh

HOST="${1:-http://localhost:57913}"
TITLE_EXPECTED="nuncio — your intelligent emissary"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$HOST/" 2>/dev/null)
TITLE=$(curl -s "$HOST/" 2>/dev/null | grep -o '<title>[^<]*</title>' | sed 's/<[^>]*>//g')

if [ "$RESPONSE" = "200" ] && [ "$TITLE" = "$TITLE_EXPECTED" ]; then
  echo "OK — $HOST responds 200 with correct title"
  exit 0
else
  echo "FAIL — $HOST returned $RESPONSE (expected 200, title '$TITLE_EXPECTED')"
  exit 1
fi
