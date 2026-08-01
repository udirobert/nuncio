# Testing and timing evidence

Hackathon demos should feel reliable even when upstream AI services are slow. Use short, focused tests to understand each component before running a full golden path.

## Credit-safe smoke tests

```bash
pnpm smoke
```

Runs local, low/no-credit checks:

- share record create/read round-trip
- script endpoint timing on a tiny synthetic enrichment payload using the deterministic fallback path

Results are saved to `artifacts/test-runs/*.json` and ignored by git. The smoke runner may reuse a reachable local server via `SMOKE_BASE_URL`; otherwise it starts `pnpm dev`. Because Next.js permits only one dev server per repository `.next` directory, stop any existing dev server before asking the runner to start on a different port, or reuse the existing server's port.

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

## LiveLink / Anam validation

LiveLink is a metered, real-time experiment. Keep tests split into credit-free contract checks, one controlled external smoke test, and a small human pilot.

### Credit-free checks

The current credit-free contract suite verifies:

- disabled `/api/share`, `/api/live/session`, and pipeline LiveLink gates;
- recorded-video share creation remains available when LiveLink is disabled;
- fail-closed workspace/sender allowlisting;
- five-minute/max-credit policy and conservative reconciliation math;
- durable lifecycle token hashing, provider-start refund, retry idempotence, and stale expiry;
- mobile collapsible controls expose `aria-expanded`/`aria-controls` and live status uses an announcement region.

Before calling Anam, keep the provider boundary mockable so tests can verify:

- missing `ANAM_API_KEY`, `ANAM_AVATAR_ID`, or `ANAM_VOICE_ID` returns a safe configuration error;
- an unknown share returns 404;
- rate limiting returns 429 without calling Anam;
- token-provider failure returns 502 and refunds a reserved credit when applicable;
- a successful token response is passed to the client without exposing the Anam API key;
- the live page handles loading, connection, disconnect, retry, five-minute cap, and fallback states;
- Sender Playbook constraints and explicit AI disclosure are present in the generated live prompt.

These checks must not require live Anam credentials or consume provider minutes.

### Controlled external smoke test

The smoke script now supports a deliberately guarded provider check. It requires a dedicated allowlisted test share, explicit confirmation, and starts at most one Anam token session:

```bash
NUNCIO_CREDITS_ENFORCED=true \
SMOKE_LIVE=1 \
SMOKE_LIVE_CONFIRM=1 \
SMOKE_LIVE_SHARE_ID=<dedicated-test-share-id> \
pnpm smoke
```

The check validates token issuance and sends one bounded terminal sync to `/api/live/sync`; it never retries indefinitely. It can reserve the full five-credit maximum even when the reported duration is zero. It does **not** establish browser WebRTC/media, so it must be followed by the browser pilot checks below. Run it only with Anam secrets configured, credits enforced, and a disposable test share. Never use production prospect data. Results record whether the paid check was enabled and are written to `artifacts/test-runs/*.json`. If `liveCleanupNeedsReview` is true, stop and reconcile through `/api/live/expire` and the credit ledger before rerunning.

### Browser pilot checks

Use Playwright or a real browser on desktop and mobile Safari/Chrome to verify the planned hardening:

- the recorded HeyGen share remains the default path;
- a gated LiveLink share can start only for an allowlisted sender/workspace;
- the page clearly discloses the AI avatar and microphone behavior;
- first connection, interruption, tab close, reconnect, idle timeout, and manual end behave safely;
- Anam failure falls back to a useful recorded-video or follow-up path;
- session duration, connection state, and failure reason are captured without raw audio by default.

The current page supports the initial connection/error/retry flow, active five-minute cap, SDK cleanup, client lifecycle telemetry, and durable terminal sync. Allowlisting, scheduled stale expiry, conservative reservation reconciliation, and the guarded provider smoke path are implemented. Idle timeout, recorded-video fallback, and provider-authoritative duration remain launch work.

### Pilot measurement

For one sender and 5–10 prospects, compare HeyGen-only with HeyGen-plus-LiveLink where practical. Capture:

- video click → live-session start;
- live-session completion and duration;
- p50/p95 time to first response and turn latency;
- qualified conversation and booked-meeting rate;
- failure/fallback rate;
- live cost per session and cost per booked meeting;
- playbook violations, misleading claims, and consent issues.

Promote LiveLink only after the go/no-go criteria in `docs/ROADMAP.md` are met. A passing token smoke test is not evidence of product-market or unit-economic fit.

## Golden-path artifact

```bash
GOLDEN_PROFILE_URL=https://github.com/vercel/next.js pnpm golden
```

Runs the real pipeline and saves a reusable submission artifact under `artifacts/test-runs/golden/`.

Useful flags:

```bash
GOLDEN_SKIP_VIDEO=1       # skip HeyGen render and use sample video for share-page proof
GOLDEN_VIDEO_TIMEOUT_MS=600000
GOLDEN_SENDER_BRIEF="..."
```

HeyGen tracking follows the current v3 flow: create a Video Agent session, poll the session until a `video_id` exists, then poll `/v3/videos/{video_id}` until `completed` with `video_url`.

## Browser/Playwright checks

Use Playwright for credit-free UX checks, especially `/?demo=true`:

- homepage loads
- demo fill button works
- progress/review/done states are understandable
- share page `/v/[id]` displays trace/canvas receipts when a record exists
- gated live share `/live/[id]` shows safe loading, disclosure, connection, disconnect, and fallback states
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