#!/bin/bash
# neatHack — Neatlogs instrumentation verification for a deployed nuncio.
#
# Proves, end to end, that the tracing in the running production container is
# live and that decision-point markers are compiled into the shipped bundle:
#
#   1. Wiring     — running commit, `neatlogs` module, NEATLOGS_* env present,
#                   every marker/workflow span name present in the build.
#   2. SDK        — `neatlogs doctor --local` (schema/fixture checks).
#   3. Readback   — `neatlogs doctor --probe`: emit → read back → verify. This
#                   is the only authenticated readback that works with the
#                   project API key; it is what proves traces *finalize*.
#   4. Live run   — one real request through the public app (`/api/agent/lite`)
#                   so the project gets a fresh product trace, plus a log scan
#                   for `[neatlogs]` init failures.
#
# Intended to run on the app host (like scripts/deploy-vps.sh), or piped over
# SSH:
#   ssh nuncio-vultr 'bash -s' < scripts/neathack-verify.sh
#
# All identity comes from env — personal defaults live in the deploy wrapper.
#   NUNCIO_CONTAINER        container to inspect (default: nuncio's Coolify id)
#   NUNCIO_PUBLIC_URL       public base URL for the live run (default: prod)
#   NUNCIO_ENV_FILE         env file whose NEATLOGS_* names are checked
#   NUNCIO_EXPECT_COMMIT    warn if the running tree is behind this commit
#   NEATLOGS_PROBE_URL      prospect URL for the live run (default: a public
#                           GitHub profile — accessible, so the run drafts
#                           instead of 422ing on a login wall)
#   NEATLOGS_EXPECT_FAILURES  space-separated doctor checks allowed to fail.
#                           Default: probe_input_output — deliberately fails
#                           while server-side PII redaction rewrites the
#                           probe's canned I/O; see docs/NEATHACK.md).
#                           Set it to an empty string to allow nothing.
#
# Exit 0 = traces are live and finalizing. Exit 1 = something to fix first.

CONTAINER="${NUNCIO_CONTAINER:-iv3o80fe9jgfa30t88kud4wp-012325559756}"
PUBLIC_URL="${NUNCIO_PUBLIC_URL:-https://nuncio.persidian.com}"
ENV_FILE="${NUNCIO_ENV_FILE:-/tmp/nuncio-env.txt}"
REMOTE_DIR="${NUNCIO_REMOTE_DIR:-/opt/nuncio}"
EXPECT_COMMIT="${NUNCIO_EXPECT_COMMIT:-}"
# Unset-only default (`-`, not `:-`): an explicitly empty value means "nothing
# may fail", which is how you make this check strict.
EXPECT_FAILURES="${NEATLOGS_EXPECT_FAILURES-probe_input_output}"

# Every span name a detection rule keys on, plus the workflow roots and child
# spans the trace map promises. Kept in sync with docs/NEATHACK.md — a name
# that stops being compiled into the bundle is a silent detection outage.
MARKER_SPANS="
nuncio.provider.tinyfish.degraded
nuncio.guardrail.low_confidence.blocked
nuncio.guardrail.credit_guard.blocked
nuncio.governance.denied
nuncio.governance.pending_approval
nuncio.llm.failover_recovered
nuncio.media.failed
nuncio.reply.heuristic_fallback
"

ROOT_SPANS="
band.pipeline_run
hermes.enqueue
hermes.prospect_run
hermes.reply_classify
hermes.earn_checkout
mcp.research_and_draft
agent.lite_run
"

CHILD_SPANS="
pipeline.research
research.orchestrator
tinyfish.enrich
tinyfish.recent_activity
tinyfish.enrich_company
pipeline.script
pipeline.review
pipeline.render
heygen.create_video
heygen.poll_render
pipeline.media_assets
b2.persist_video
genblaze.composite
stripe.find_customer
stripe.create_checkout
"

deps_ok() {
  command -v docker >/dev/null 2>&1 || { echo "✗ docker not found on this host"; exit 1; }
  command -v node >/dev/null 2>&1 || { echo "✗ node not found (needed to parse doctor --json)"; exit 1; }
}

# doctor writes a JSON object to stdout and npm notices to stderr; strip any
# leading noise so the payload parses. Prints a summary, exits 1 on failure.
summarize_doctor() {
  local label="$1" payload="$2"
  node -e '
    const fs = require("fs");
    const raw = fs.readFileSync(process.argv[1], "utf8");
    const start = raw.indexOf("{");
    if (start < 0) { console.log(`✗ ${process.argv[2]}: no JSON in output`); process.exit(1); }
    let d;
    try { d = JSON.parse(raw.slice(start)); }
    catch { console.log(`✗ ${process.argv[2]}: unparseable JSON`); process.exit(1); }

    const allowed = new Set(
      (process.env.EXPECT_FAILURES || "").split(/\s+/).filter(Boolean),
    );
    const mode = d.mode || "local";
    const checks = d.checks || [];
    const failed = checks.filter((c) => c.status !== "pass");
    const unexpected = failed.filter((c) => !allowed.has(c.name));

    for (const c of failed) {
      const tag = allowed.has(c.name) ? "expected" : "UNEXPECTED";
      console.log(`   [${tag}] ${c.name}: ${String(c.message || "").slice(0, 160)}`);
    }
    // Mode-specific signal: the probe is the only run that proves readback.
    if (mode === "probe" && d.probe) {
      console.log(
        `   probe: finalized=${d.probe.finalized} visible=${d.probe.visible} ` +
        `spans=${d.probe.readback_span_count} roots=${d.probe.meaningful_root_count} ` +
        `duplicates=${d.probe.duplicate_span_count} hierarchy=${d.probe.hierarchy_valid}`,
      );
      if (!d.probe.finalized) {
        console.log("✗ probe trace did not finalize — spans are reaching ingest but the backend has not assembled them (vendor-side; retry before the demo)");
        process.exit(1);
      }
    }
    if (unexpected.length > 0) {
      console.log(`✗ ${process.argv[2]}: ${unexpected.length} unexpected failure(s); ${checks.length - failed.length}/${checks.length} pass`);
      process.exit(1);
    }    console.log(
      `✓ ${process.argv[2]}: ${checks.length - failed.length}/${checks.length} pass ` +
      (failed.length ? `(${failed.length} expected: ${failed.map((c) => c.name).join(", ")})` : "(nothing failed)"),
    );
  ' "$payload" "$label"
}

deps_ok

FAILED=0
note_fail() { echo "✗ $1"; FAILED=$((FAILED + 1)); }

echo "→ [1/4] Wiring"

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  note_fail "container ${CONTAINER} not found"
  echo "  (set NUNCIO_CONTAINER; list with: docker ps --format '{{.Names}}')"
  echo ""
  echo "✗ verification aborted — no container to inspect"
  exit 1
fi
STATE=$(docker inspect -f '{{.State.Status}}|{{.Created}}|{{.Config.Image}}' "$CONTAINER")
echo "   container: ${STATE}"
[ "${STATE%%|*}" = "running" ] || note_fail "container is not running (${STATE%%|*})"

RUNNING_COMMIT=$(cd "$REMOTE_DIR" 2>/dev/null && git rev-parse --short HEAD 2>/dev/null || echo unknown)
echo "   source commit: ${RUNNING_COMMIT}"
if [ -n "$EXPECT_COMMIT" ] && [ "$RUNNING_COMMIT" != "$EXPECT_COMMIT" ]; then
  note_fail "running tree is ${RUNNING_COMMIT}, expected ${EXPECT_COMMIT} — deploy before verifying"
fi

docker exec "$CONTAINER" sh -c 'ls -d /app/node_modules/neatlogs >/dev/null 2>&1' \
  || note_fail "neatlogs module missing from the image"

# Env names only — never echo values.
ENV_NAMES=$(docker exec "$CONTAINER" sh -c 'env | grep -o "^NEATLOGS[A-Z_]*" | sort -u' 2>/dev/null | tr '\n' ' ')
echo "   NEATLOGS vars in container: ${ENV_NAMES:-none}"
WORKFLOW_NAME=$(docker exec "$CONTAINER" sh -c 'printf %s "$NEATLOGS_WORKFLOW_NAME"' 2>/dev/null || echo "")
echo "   workflow name: ${WORKFLOW_NAME:-<unset>}"
for v in NEATLOGS_API_KEY NEATLOGS_ENDPOINT NEATLOGS_WORKFLOW_NAME; do
  echo "$ENV_NAMES" | grep -qw "$v" || note_fail "container is missing ${v} (staged in ${ENV_FILE}? also set it in Coolify — a Coolify-triggered redeploy injects from its own DB)"
done
if [ -f "$ENV_FILE" ]; then
  MISSING_FILE=$(for v in NEATLOGS_API_KEY NEATLOGS_ENDPOINT NEATLOGS_WORKFLOW_NAME; do
    grep -q "^${v}=" "$ENV_FILE" || echo "$v"
  done | tr '\n' ' ')
  [ -z "$MISSING_FILE" ] || note_fail "${ENV_FILE} is missing: ${MISSING_FILE} (a script deploy would boot a container with no tracing)"
else
  echo "   ⚠ ${ENV_FILE} not found — cannot check the deploy env file (fine if deploying only via Coolify)"
fi

# Span names must survive compilation into the shipped server bundle.
# One grep per name, run inside the container: BusyBox's recursive -o -f
# combination silently drops matches (verified 2026-10-12), while per-name
# `grep -rlF` is accurate. Source maps are excluded — they aren't shipped code.
PATTERN_FILE=$(mktemp)
trap 'rm -f "$PATTERN_FILE"' EXIT
printf '%s\n' $MARKER_SPANS $ROOT_SPANS $CHILD_SPANS | sed '/^$/d' | sort -u > "$PATTERN_FILE"

GREP_CMD="cd /app/.next/server 2>/dev/null || exit 3"
while IFS= read -r name; do
  [ -z "$name" ] && continue
  GREP_CMD="${GREP_CMD}; printf '%s -> %s\\n' '${name}' \"\$(grep -rlF '${name}' . 2>/dev/null | grep -v '[.]map' | wc -l)\""
done < "$PATTERN_FILE"

FOUND_FILE=$(mktemp)
docker exec "$CONTAINER" sh -c "$GREP_CMD" > "$FOUND_FILE" 2>/dev/null || true

MISSING=""
FOUND_COUNT=0
EXPECTED_COUNT=0
while IFS= read -r name; do
  [ -z "$name" ] && continue
  EXPECTED_COUNT=$((EXPECTED_COUNT + 1))
  hits=$(sed -n "s/^${name} -> \([0-9]*\)$/\1/p" "$FOUND_FILE" 2>/dev/null | head -1)
  if [ -n "$hits" ] && [ "$hits" -gt 0 ]; then
    FOUND_COUNT=$((FOUND_COUNT + 1))
  else
    MISSING="${MISSING}${name} "
  fi
done < "$PATTERN_FILE"
rm -f "$FOUND_FILE"
echo "   span names compiled into /app/.next/server: ${FOUND_COUNT}/${EXPECTED_COUNT}"
if [ -n "$MISSING" ]; then
  echo "   missing: ${MISSING}"
  # Roots and markers are the ones detections and the demo depend on.
  for name in $MARKER_SPANS $ROOT_SPANS; do
    case " $MISSING " in
      *" $name "*) note_fail "detection-critical span name not in the build: ${name}";;
    esac
  done
  for name in $CHILD_SPANS; do
    case " $MISSING " in
      *" $name "*) echo "   ⚠ child span not found (may be inlined/dynamic): ${name}";;
    esac
  done
else
  echo "   ✓ every expected span name is in the build"
fi

export EXPECT_FAILURES

echo "→ [2/4] SDK check (doctor --local)"
LOCAL_JSON=$(mktemp)
docker exec "$CONTAINER" sh -c "cd /app && npx --no-install neatlogs doctor --local --json" >"$LOCAL_JSON" 2>/dev/null || true
# The local run never touches the network, so nothing may fail here.
SAVED_EXPECT="$EXPECT_FAILURES"
EXPECT_FAILURES=""
summarize_doctor "doctor --local" "$LOCAL_JSON" || note_fail "doctor --local reported failures"
EXPECT_FAILURES="$SAVED_EXPECT"
rm -f "$LOCAL_JSON"

echo "→ [3/4] Authenticated readback (doctor --probe)"
PROBE_JSON=$(mktemp)
docker exec "$CONTAINER" sh -c "cd /app && npx --no-install neatlogs doctor --probe --json" >"$PROBE_JSON" 2>/dev/null || true
summarize_doctor "doctor --probe" "$PROBE_JSON" || note_fail "doctor --probe failed (see above) — traces are not finalizing end to end"
rm -f "$PROBE_JSON"

echo "→ [4/4] Live product trace"
STARTED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# A login-walled URL is *rejected* by this route (422), not degraded-and-drafted,
# so the smoke check uses an accessible profile and only asserts that a real
# trace is produced. Exercise the degraded path in the studio instead.
PROBE_URL="${NEATLOGS_PROBE_URL:-https://github.com/torvalds}"
RESP=$(curl -sS -m 90 -X POST "${PUBLIC_URL}/api/agent/lite" \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"${PROBE_URL}\",\"senderName\":\"Neatlogs verify\",\"senderBrief\":\"Instrumentation smoke check.\"}" \
  -w '\n%{http_code}' 2>&1 || echo -e "\n000")
CODE=$(printf '%s' "$RESP" | tail -n1)
BODY=$(printf '%s' "$RESP" | sed '$d')
echo "   POST /api/agent/lite → ${CODE}"
if [ "$CODE" = "200" ]; then
  node -e '
    try {
      const b = JSON.parse(process.argv[1]);
      const q = b.researchQuality || {};
      console.log(`   outcome: drafted | confidence=${q.confidence || "unknown"} ` +
        `sources=${q.sourceCount ?? "?"} recentPosts=${q.recentPostCount ?? "?"} ` +
        `searchFallback=${q.usedSearchFallback ?? "?"}`);
      if (q.usedSearchFallback) {
        console.log("   → degraded-provider path taken: expect a nuncio.provider.tinyfish.degraded marker span on this trace");
      }
    } catch { console.log("   (response not JSON; skipping quality summary)"); }
  ' "$BODY" 2>/dev/null || true
else
  note_fail "live run returned ${CODE} — no fresh product trace for the demo"
  printf '%s\n' "$BODY" | head -c 300; echo
fi

sleep 5
NOISE=$(docker logs --since "$STARTED_AT" "$CONTAINER" 2>&1 | grep -iE '\[neatlogs\]' || true)
if [ -n "$NOISE" ]; then
  echo "   ⚠ neatlogs reported a problem during the run:"
  printf '%s\n' "$NOISE" | head -5
  note_fail "neatlogs logged an init/export warning during the live run"
else
  echo "   ✓ no [neatlogs] warnings in the container log during the run"
fi
echo "   trace should appear in the Neatlogs dashboard under workflow ${WORKFLOW_NAME:-${NEATLOGS_WORKFLOW_NAME:-nuncio-outreach}} (agent.lite_run)"

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "✓ Neatlogs verification passed — instrumentation live, probe trace finalized."
  exit 0
fi
echo "✗ Neatlogs verification found ${FAILED} problem(s) — fix before recording the demo."
exit 1
