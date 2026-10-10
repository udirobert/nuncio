# neatHack (Oct 10–12) — Neatlogs observability entry

> Working doc for the neatlogs hackathon submission. Build window Oct 10–12;
> demo video submitted on X Mon Oct 12, 19:00–23:55 IST; winners Oct 16.

**Entry:** nuncio instrumented with the Neatlogs TypeScript SDK — real traces
from the two agent systems (Band studio pipeline + Hermes autonomous loop)
plus the public agent surfaces (lite, MCP).

## What was built

- `src/lib/neatlogs.ts` — opt-in, lazy-init wrapper (`NEATLOGS_API_KEY`;
  `NEATLOGS_ENDPOINT`, `NEATLOGS_WORKFLOW_NAME`, `NEATLOGS_DISABLE_EXPORT`).
  `traced()` runs a callback inside a Neatlogs span and hands it a minimal
  `setAttribute` handle; without the key everything is a no-op. Errors thrown
  inside `traced()` are recorded on the span and re-thrown — instrumentation
  never swallows or produces failures. `captureLogs: false` — console-log
  capture goes through a separate export path whose PII-redaction coverage
  is unverified, and prospect URLs/prompts can appear in console output.
- `next.config.ts` — `serverExternalPackages: ["neatlogs"]`.
- `src/server/production.ts` — SIGTERM/SIGINT drain (`flush()` + `shutdown()`).

## Trace map

| Workflow root | Where | What it groups |
|---|---|---|
| `band.pipeline_run` | `src/app/api/pipeline/route.ts` | One studio run; sessionId = SSE session (resumed runs group together) |
| `hermes.enqueue` | `src/app/api/agent/prospect-queue/route.ts` POST | Queue call incl. governance deny / pending_approval |
| `hermes.prospect_run` | same file, `processQueueEntry` | Full autonomous run; sessionId = queueId |
| `hermes.reply_classify` | `src/app/api/agent/reply-webhook/route.ts` | Reply classification incl. LLM→heuristic fallback |
| `hermes.earn_checkout` | `src/app/api/agent/earn-checkout/route.ts` | Stripe checkout incl. governance decision |
| `mcp.research_and_draft` | `src/app/api/mcp/research-and-draft/route.ts` | ChatGPT/MCP tool run |
| `agent.lite_run` | `src/app/api/agent/lite/route.ts` | Public no-auth draft run |

Child spans (all nest under whichever workflow is active):

| Span | Kind | File |
|---|---|---|
| `pipeline.research` | CHAIN | `src/lib/pipeline/steps.ts` |
| `research.orchestrator` | TOOL | steps.ts (deep/balanced tier) |
| `tinyfish.enrich` / `tinyfish.recent_activity` / `tinyfish.enrich_company` | TOOL | steps.ts |
| `pipeline.script` | AGENT | steps.ts |
| `pipeline.review` | GUARDRAIL | steps.ts |
| `pipeline.render` → `heygen.create_video` / `heygen.poll_render` | TOOL | steps.ts |
| `pipeline.media_assets` → `b2.persist_video` / `genblaze.composite` | CHAIN/TOOL | steps.ts |
| `llm.<provider>` | LLM | `src/lib/llm.ts` — one span per provider attempt, so the fallback chain (e.g. failed `llm.venice` → ok `llm.featherless`) reads as an in-trace recovery |
| `stripe.find_customer` / `stripe.create_checkout` | TOOL | earn-checkout |

## Detection rules (created via public API)

IMPORTANT: Neatlogs detections only evaluate canonical span fields
(`span_name`, `status`, `latency`, `cost`, `input`, `output`) — custom
`nuncio.*` attributes are exported on the wire but are NOT visible to the
condition engine (verified 2026-10-10: `span_name` rule hit retroactively,
`nuncio.*` field paths all returned zero hits). Decision points therefore
emit a named **marker span** via `mark()` in `src/lib/neatlogs.ts`, which is
what these detections key on:

| Detection | Polarity | Span type | Rule |
|---|---|---|---|
| TinyFish degraded | Negative | TOOL | `span_name = nuncio.provider.tinyfish.degraded` |
| Thin-profile render block | Neutral | GUARDRAIL | `span_name = nuncio.guardrail.low_confidence.blocked` |
| Credit guard 402 | Neutral | GUARDRAIL | `span_name = nuncio.guardrail.credit_guard.blocked` |
| Governance hold | Neutral | GUARDRAIL | `span_name contains nuncio.governance.` |
| LLM provider failed | Negative | LLM | `span_name contains llm.` AND `status = ERROR` |
| Recovered: provider failover | Positive | CHAIN | `span_name = nuncio.llm.failover_recovered` (emitted only when attempt >1 succeeds) |
| Render failed | Negative | TOOL | `span_name = pipeline.render` AND `status = ERROR` |
| Media assets failed | Negative | TOOL | `span_name = nuncio.media.failed` |
| Reply heuristic fallback | Negative | CHAIN | `span_name = nuncio.reply.heuristic_fallback` |
| PII in traces | Neutral | all | built-in `pii` type |

Marker call sites: `steps.ts` (tinyfish.degraded), `pipeline/route.ts`
(low-confidence block, media failed, credit guard), `prospect-queue`
(governance denied/pending, low-confidence, media), `earn-checkout`
(governance denied/pending), `reply-webhook` (heuristic fallback),
`llm.ts` (failover_recovered).

## The "one honest recovered run" demo

The submit metric is one real failed-then-recovered run, not coverage stats.
The easiest honest one, already in the product:

1. Run a Band pipeline on a prospect URL while TinyFish is degraded
   (or point at a profile behind a login wall).
2. `tinyfish.enrich` span shows warnings / search fallback →
   `nuncio.provider.tinyfish.degraded` marker span fires →
   `pipeline.research` reports low confidence →
   the workflow refuses to spend the HeyGen render credit
   (`nuncio.guardrail.low_confidence.blocked` marker span) →
   run completes with a `script_ready` outcome.
3. In the dashboard: detection badges on the trace, then "Investigate" →
   the evidence reads itself: provider degraded → confidence gate →
   credit preserved → draft still delivered.
4. Second act (same trace family): retry the render after review →
   `band.pipeline_run` session shows the recovered `video_ready` run.

Alternative if the LLM chain is the star: kill one provider key locally
(e.g. `ANTHROPIC_API_KEY=bad`) → `llm.anthropic` span errors →
`llm.venice`/`llm.featherless` span succeeds in the same trace and emits
the `nuncio.llm.failover_recovered` marker.
Same story in `hermes.reply_classify`: LLM failure →
`nuncio.reply.heuristic_fallback` marker, classification still lands.

## Verify

- `pnpm exec neatlogs doctor --local --json` — SDK pass (schema v2).
- `pnpm exec neatlogs doctor --probe --json` — authenticated readback (needs key).
  16/17 pass; `probe_input_output` fails because the project's server-side
  PII redaction (Settings → PII Redaction) rewrites the probe's canned I/O —
  expected while that policy is on, and we keep it on deliberately.
- Local no-export check: `NEATLOGS_API_KEY=x NEATLOGS_DISABLE_EXPORT=true pnpm dev`.
- Trace readback with just the project key (no OAuth):
  `GET https://ingest.neatlogs.com/api/traces/v3?projectId=<id>` (list) and
  `/api/traces/v3/<traceId>?projectId=<id>` (detail), header `x-api-key`.
  Note: the v3 projection does NOT return custom `nuncio.*` span attributes —
  verified they're exported (raw span log), but the detection engine can't
  evaluate them either (see the IMPORTANT note above) — they're
  debugging context only.

Verified 2026-10-10: two real `agent.lite_run` traces landed (traceIds
`e80ccd…25de`, `eaa244…2300`) — 8 spans each: workflow → pipeline.research
(+ tinyfish.enrich/recent_activity) → llm.venice ×2 → pipeline.script →
pipeline.review. First run shows the recovery story: login-wall fetch →
search fallback → drafted anyway.

Known caveat (2026-10-10): after ~15:10 UTC the Neatlogs backend stopped
finalizing new traces — every subsequent run (incl. a trivial 1-span probe
that finalized in seconds earlier) sits `pending` with 0 assembled spans.
Spans are still accepted (trace rows appear); the backlog is server-side,
not an export/config issue on our end. Detection hits and waterfall views
are blocked until it drains. Runs 4–6 captured a real venice→fallback
recovery and will show `llm.venice` ERROR + `nuncio.llm.failover_recovered`
once finalized.

Production env (2026-10-10): `NEATLOGS_API_KEY`, `NEATLOGS_ENDPOINT`,
`NEATLOGS_WORKFLOW_NAME=nuncio-outreach` added to `/tmp/nuncio-env.txt` on
nuncio-vultr (with durable copy `~/nuncio-env.txt`) — next `deploy-vps.sh`
deploy injects them. NOTE: also add the same three vars in the Coolify
dashboard (app env vars) — the env file only covers script deploys; a
Coolify-triggered redeploy injects from its own DB.

## Submission checklist

- [x] `NEATLOGS_API_KEY` (+endpoint, workflow name) staged in prod deploy env;
  verify first prod trace after next deploy (`doctor --probe` optional)
- [ ] Run the recovered-run demo against prod, confirm traces + detections land
- [ ] Demo video (per neatHack format, post on X between 19:00–23:55 IST Oct 12)
- [ ] Repo link + README section already in place
