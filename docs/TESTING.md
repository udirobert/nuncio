# Testing and timing evidence

Hackathon demos should feel reliable even when upstream AI services are slow. Use short, focused tests to understand each component before running a full golden path.

## Credit-safe smoke tests

```bash
pnpm smoke
```

Runs local, low/no-credit checks:

- share record create/read round-trip
- script endpoint timing on a tiny synthetic enrichment payload using the deterministic fallback path

Results are saved to `artifacts/test-runs/*.json` and ignored by git.

By default this exercises the active share metadata provider:

- `file` if `TURSO_DATABASE_URL` is unset
- `turso` if `TURSO_DATABASE_URL` is set

Grove proof publishing is skipped unless `GROVE_ENABLED=true`.

## Single external enrichment timing

```bash
SMOKE_EXTERNAL=1 pnpm smoke
```

Adds one TinyFish request against `https://github.com/vercel/next.js` by default. To choose another URL:

```bash
SMOKE_EXTERNAL=1 SMOKE_PROFILE_URL=https://github.com/vercel/next.js pnpm smoke
```

## Live LLM timing

```bash
SMOKE_LLM=1 pnpm smoke
```

Adds one live LLM script-generation request. Use this to measure the real wait time for the configured provider. Keep it separate from the default smoke test so the demo has a deterministic fallback baseline.

With Featherless Premium, prefer setting a warm, instruction-following model before running this test:

```bash
FEATHERLESS_MODEL=deepseek-ai/DeepSeek-V4-Flash
FEATHERLESS_TIMEOUT_MS=15000
```

Premium concurrency budget reminder: a ≥70B / DeepSeek / Kimi class model can consume the full concurrency budget for one request. Keep this test single-flight.

## HeyGen start-only check

```bash
SMOKE_VIDEO=1 pnpm smoke
```

This starts one short HeyGen render job but does not poll for completion. Use sparingly because it can consume video credits.

## Browser/Playwright checks

Use Playwright for credit-free UX checks, especially `/?demo=true`:

- homepage loads
- demo fill button works
- progress/review/done states are understandable
- share page `/v/[id]` displays trace/canvas receipts when a record exists
- mobile/desktop screenshots look presentable

Recommended artifacts to keep from browser runs:

- desktop screenshot of input state
- script review screenshot showing agent trace
- final video screenshot showing demo receipts
- `/v/[id]` screenshot showing "How this was made"

## Reading timings

Use the JSON result fields:

- `durationMs` per component
- `totalDurationMs` for the run
- `ok` and `error` for pass/fail

Translate the timings into UX copy. For example:

- enrichment under 5s: "Researching public context"
- script generation 10–25s: show agent trace placeholders and source chips
- video generation 60–180s: offer a completed artifact fallback during live demos