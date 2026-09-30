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

## LiveLink provider validation

LiveLink is a metered, real-time experiment. Keep tests split into credit-free contract checks, one controlled external smoke test, and a small human pilot.

### Credit-free checks

The current credit-free contract suite verifies:

- disabled `/api/share`, `/api/live/session`, and pipeline LiveLink gates;
- recorded-video share creation remains available when LiveLink is disabled;
- fail-closed workspace/sender allowlisting;
- five-minute/max-credit policy and conservative reconciliation math;
- durable lifecycle token hashing, provider-start refund, retry idempotence, and stale expiry;
- mobile collapsible controls expose `aria-expanded`/`aria-controls` and live status uses an announcement region.

Before calling a live provider, keep the provider boundary mockable so tests can verify:

- missing LiveKit/Synthesia or `ANAM_*` configuration returns a safe configuration error;
- an unknown share returns 404;
- rate limiting returns 429 without calling a live provider;
- provider-start failure refunds a reserved credit when applicable and follows the Synthesia → confirmed-cleanup → Anam ordering;
- successful provider responses are passed to the client without exposing provider secrets;
- the live page handles loading, connection, disconnect, retry, five-minute cap, provider fallback, and recorded-video fallback states;
- Sender Playbook constraints and explicit AI disclosure are present in the generated live prompt.

These checks must not require live provider credentials or consume provider minutes.

### Call-request / provider-routing suite (added 2026-09)

All unit-level — no live provider calls:

- `src/lib/call-request.test.ts` — storage-provider contracts only: single-open admission, concurrent-insert single-winner, versioned CAS transitions, expiry gating, redacted workspace listing (file + local libsql providers). It does not exercise the domain helpers in `src/lib/call-request.ts` (accept/expire/cleanup ordering) — those are covered by the manual checklist until domain tests exist.
- `src/app/api/live/call-requests.test.ts` — mocked-provider route checks: auth and authorization (owner vs recipient vs cross-workspace), proof mismatch, expired/declined rejection, recipient cannot accept, availability expiry gating, public redaction. Route mocks were mechanically updated to the versioned-CAS contract; they assert call shapes, not real LiveKit behavior.
- `src/lib/live-handoff.test.ts` — helper + storage contracts: token mint/hash/compare, cookie-name validation, booking URL validation, raw-bearer cookie authorization (record-id and cross-share cookies rejected, owner session bypass only while active, expired/revoked deny all), `getHandoffOptions`/`effectiveHandoffNextStep` honesty, verbatim prompt guard append, file provider (cross-instance persistence, corruption/non-array/partial-record failure, duplicate-create rejection including after revoke, persist-failure fail-closed create and revoke-retry, concurrent create/revoke, defensive copies), local libsql provider (PK duplicate rejection, scoped atomic monotonic revoke, scoped listing).
- `src/lib/live-handoff-client.test.ts` — fragment-stripped-before-fetch ordering, fail-closed on strip failure, malformed/oversized/empty token rejection without fetch, non-OK/network failures as generic errors, per-share in-flight dedupe, token never placed in the request URL.
- `src/app/api/agent/handoffs.test.ts` — mocked-provider route checks: bearer auth, `NUNCIO_AGENT_WORKSPACE_ID` required, allowlist gate, body/list/TTL validation, source-share ownership, private share shape + hashed-token invite URL, honest options/effective recommendation, redacted listing, idempotent monotonic revoke, cookie exchange (raw-token cookie value + flags + bounded maxAge), protected-share denial on GET/session/availability/call-request-create before signing or credits, revoked invite denial for cookie holders, ordinary shares unaffected, agent inbox exact-linkage context scoping/redaction, generic-500 boundary, worker gateway revocation denial before any LLM call.
- `src/app/api/live/provider-routing.test.ts` — primary selection, missing Synthesia config → Anam fallback, cleanup ordering before fallback, cleanup failure refuses fallback, all-providers-missing safe error, gate/allowlist rejection before provider calls/credits, actual provider+room recorded on the session, secret-free response.
- `src/app/api/live/agent-chat.test.ts` — worker gateway auth (fail-closed absent token, constant-time compare), ignored client system/developer injection, message limits, `chatCompletion` invoked only with the server prompt + exact untrusted-dialogue wrapper.
- `src/lib/live-call-brief.test.ts` (authored this pass, not yet re-run) — `parseBriefDialogue` bounds (0/21 messages, 2001-char message, 12001-char total, disallowed roles, whitespace normalization), `parseLiveCallBrief` schema (exact four fields, 501-char rejection, unknown keys), `draftLiveCallBrief` mocked-LLM invalid-JSON/extra-key/success paths, `hasSenderPlaybook` blank/partial/full.
- `src/lib/live-room-attach.test.ts` — `detachUnsubscribedTrack` keeps the React-owned video element mounted on unsubscribe while removing dynamically created audio elements; a second track can attach afterwards.
- `src/lib/llm.test.ts` (authored this pass, not yet re-run) — `chatCompletion` with `redactErrors: true` logs provider + exception class only and never the raw error message; default behavior unchanged.
- `src/app/api/agent/handoffs.test.ts` (brief + liveBrief + readiness cases, authored this pass, not yet re-run) — `POST /api/live/brief` rejects missing consent, malformed dialogue, invalid session proof, cross-share and cross-workspace sessions, terminal sessions, cross-origin posts, expired/revoked handoff invites (404), and rate-limit denial (429, no LLM call) before any LLM call; returns the draft only on a valid consented request; 503s on draft failure without storing dialogue. Call-request creation stores only the four reviewed brief fields with `source: "recipient_reviewed"`/`sharedAt`, and rejects a brief without `briefConsent`, a malformed brief, or a brief without a valid live-session binding. Public status and join responses exclude `liveBrief`; the owner list includes it. `GET /api/account/brief` reports `liveReadiness.configured` false when unauthenticated, off-allowlist, or provider-unconfigured, and true for a Synthesia-only workspace with no Anam assets.
- `src/app/api/live/agent-chat.test.ts` (amended, not yet re-run) — the worker gateway asserts `chatCompletion` is called with `redactErrors: true` so provider error messages carrying dialogue are never logged.

Browser smoke (mocked APIs only, no provider calls): pending ≠ joined states, autoplay/mic-denied alternatives visible, video target mounted before SDK start, Synthesia branch renders a LiveKit room — all pending the user's verification run; none have been re-run since the hardening pass.

The Python worker (`workers/live-avatar/agent.py`) passed `python3 -m py_compile` on an intermediate revision of this pass; the worker file changed afterwards and has not been recompiled. It has not been run against live credentials — do not run it against live credentials until user-verified. Its logging reports a stage name plus exception class only (initialization, connect, STT, session, avatar, conversation) — never raw exception messages, prompts, request bodies, or tokens.

### Controlled external smoke test

The smoke script now supports a deliberately guarded provider check. It requires a dedicated allowlisted test share, explicit confirmation, and starts at most one live-provider session (currently the Anam fallback path):

```bash
NUNCIO_CREDITS_ENFORCED=true \
NUNCIO_LIVE_PRIMARY_PROVIDER=anam \
SMOKE_LIVE=1 \
SMOKE_LIVE_CONFIRM=1 \
SMOKE_LIVE_SHARE_ID=<dedicated-test-share-id> \
pnpm smoke
```

The check validates Anam token issuance and sends one bounded terminal sync to `/api/live/sync`; it never retries indefinitely. Set `NUNCIO_LIVE_PRIMARY_PROVIDER=anam` for this smoke run or it will attempt the Synthesia/LiveKit path first. It can reserve the full five-credit maximum even when the reported duration is zero. It does **not** establish browser WebRTC/media, so it must be followed by the browser pilot checks below. Run it only with Anam secrets configured, credits enforced, and a disposable test share. Never use production prospect data. Results record whether the paid check was enabled and are written to `artifacts/test-runs/*.json`. If `liveCleanupNeedsReview` is true, stop and reconcile through `/api/live/expire` and the credit ledger before rerunning.

### Browser pilot checks

Use Playwright or a real browser on desktop and mobile Safari/Chrome to verify the planned hardening:

- an allowlisted pilot defaults to a live conversation link; explicit recorded-video delivery remains available;
- a gated LiveLink share can start only for an allowlisted sender/workspace;
- the page clearly discloses the AI avatar and microphone behavior;
- first connection, interruption, tab close, reconnect, idle timeout, and manual end behave safely;
- a failed Synthesia start cleans up and falls back to Anam once; a failed live path ultimately falls back to the recorded `/v/[id]` artifact;
- session duration, connection state, and failure reason are captured without raw audio by default.

The current page implements the initial connection/error/retry flow, active five-minute cap, SDK cleanup, client lifecycle telemetry, durable terminal sync, provider startup fallback, and recorded-video fallback when a recorded artifact exists. The worker adds a five-minute maximum, three-minute idle timeout, and 45-second recipient reconnect grace. Synthesia/LiveKit startup was verified on the previous deployed revision; this consolidation is undeployed and its final revision has not been execution-verified. The user owns the full two-person speech-to-handoff check, desktop/mobile checks, and final automated verification. Provider-authoritative duration, push notifications, and phone bridging remain launch work.

### Pilot measurement

For one sender and 5–10 prospects, compare HeyGen-only with HeyGen-plus-LiveLink where practical. Capture:

- video click → live-session start;
- live-session completion and duration;
- call-request metrics per `docs/STRATEGY.md`: call-request acceptance = accepted requests / created requests; connection success = requests with both authenticated owner and recipient observed in room / accepted requests; owner response latency = acceptedAt - createdAt; human connection latency = first joint room presence - createdAt. Presence is recorded server-side via `/api/live/call-requests/[id]/presence` (5s client heartbeat + participant events) and the signed `/api/live/call-requests/webhook`, merged through the frozen `src/lib/call-connection.ts` module — timestamps are **server-observed**, not exact physical connect times; booking clicks are a proxy, not confirmed meetings);
- p50/p95 time to first response and turn latency;
- qualified conversation and booked-meeting rate;
- failure/fallback rate;
- live cost per session and cost per booked meeting;
- playbook violations, misleading claims, and consent issues.

Promote LiveLink only after the go/no-go criteria in `docs/ROADMAP.md` are met. A passing token smoke test is not evidence of product-market or unit-economic fit.

For the call-request bridge specifically, the pilot must answer three questions against the booking-link control arm: **utility** (do accepted requests produce real human conversations?), **recipient sincerity** (do requesters actually join, or is it drive-by curiosity?), and **owner burden** (response latency distribution and interruption cost per request). Compare meetings earned per artifact against the booking-link-only path.

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

## LiveLink call-bridge manual checklist (user-owned verification)

The latest concurrency/lifecycle hardening pass was implemented without automated verification — the user owns testing. Nothing below has been run in this pass.

1. `pnpm test src/app/api/live src/lib/call-request.test.ts` then `pnpm typecheck` and ESLint on touched files.
2. With dev server + LiveKit project configured: create a call request, accept it twice quickly — accepts are idempotent (a racing second accept may return 200 on the already-accepted request or 409; exactly one room must be created). Join from both sides and confirm "joined" flips only on real presence; disconnect one side and confirm presence clears.
3. Recipient in a Synthesia twin room requests a call → accept → recipient stays in the same room (borrowed transport), avatar steps aside only when the owner actually joins; disconnect the recipient mid-handoff and rejoin within the grace window — twin must not have shut down early.
4. Cancel / decline / expiry each close the room exactly once (`roomClosedAt` set; `cleanupError` never silently true); kill the LiveKit REST endpoint mid-cleanup and confirm `cleanupError: true` surfaces and the next `/api/live/expire` run retries.
5. Webhook: point the LiveKit project's webhook at `POST /api/live/call-requests/webhook` (LiveKit signs with the project API key/secret — configure under the LiveKit server's `webhook:` section or dashboard); verify unsigned events get 401 and `room_finished` terminalizes accepted calls.
6. `/api/live/expire` scheduler: POST every minute with `Authorization: Bearer $NUNCIO_LIVELINK_CRON_TOKEN` — confirm expired opens flip to `expired`, rooms close, and `callRequests.errors`/`twinRoomErrors` stay 0.
7. Worker: build a named image from the worker directory (`docker build -t nuncio-live-avatar workers/live-avatar` — installs the hash-locked `requirements.lock`, downloads the Silero resource at build time, runs non-root), then run it with the worker env (`docker run --env-file <worker-env> nuncio-live-avatar`) — confirm it fails closed on missing config/bad metadata, steps aside on `owner-*`, and shuts down promptly (no full idle wait after shutdown).
8. Owner dashboard: availability toggle persists only after PATCH success, countdown ticks locally, accept/decline/join/poll failures surface safe errors.
9. Handoff path (all untested this pass): `POST /api/agent/handoffs` with bearer + `NUNCIO_AGENT_WORKSPACE_ID`, open `#handoff=` link in a fresh browser — cookie exchange grants entry, revoking via DELETE denies new entry but does not force-end a connected call, expired invites show the unavailable state instead of polling forever, handoff context appears in the owner inbox as "Text conversation context" and reaches the twin prompt as untrusted data.

## Frontend IA redesign manual checklist (user-owned)

The frontend redesign (homepage journey illustration, `/dashboard?view=setup`, recipient front-door cards, first-touch list) was implemented without automated verification — the user owns testing. Nothing below has been run.

1. Setup view: load `/dashboard?view=setup` — the panel loads saved values or reports a load error with Retry; save with/without a booking URL; non-HTTPS booking URLs are rejected client-side; the status checklist shows "unknown" when the brief fetch fails and never claims provider health.
2. Keyboard: tab through the homepage `RelationshipJourney` — all four stage buttons and choice buttons are focusable, `aria-pressed` reflects the active stage, and no timer advances anything.
3. Reduced motion: with `prefers-reduced-motion` on, the journey swaps stages without transforms/durations.
4. Mobile + long names: narrow viewport and very long sender names wrap in the live front-door cards; touch targets ≥44px.
5. Request states on `/live/[id]`: pending ≠ accepted ≠ joined; the "Human call room" banner marks the human phase (room open), while the joined/connected text inside `LiveCallRoom` is the only observed-presence claim.
5b. Login return: sign out, visit `/dashboard?view=setup` → login → verify lands on setup (not studio); `/login?next=https://evil.example` falls back to `/studio`; invalid verify tokens return to login with `next` preserved.
6. Stable video: starting/stopping the AI session and entering a human call never remounts the `<video>` element or `CallRequestPanel`.
7. Consent: "Draft brief" only sends dialogue after explicit click; the skip path ("Request … now") is never blocked by brief drafting.
8. Copied links: "Copy link" on the dashboard only appears for ordinary shares; invitation-protected handoffs show "Owner view" and never offer a copyable link missing its fragment.
