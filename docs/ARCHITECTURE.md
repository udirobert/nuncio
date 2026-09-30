# Architecture

## Overview

nuncio is a multi-agent platform for personalized outreach. The current product is video-first: agents research a prospect, draft a script, and render a personalized video. The next chapter is a **conversational SDR** — a live AI avatar of the sender that can hold a real-time conversation with the prospect.

Recorded video is the fallback artifact; live conversation is the product; the same research and synthesis pipeline powers both. Full thesis and plan: `docs/STRATEGY.md` (single source of truth for strategy).

---

## API Routes

| Route | Method | Description |
|-------|--------|-----------|
| `/api/enrich` | POST | Enrich prospect profile via TinyFish |
| `/api/script` | POST | Generate personalized script via LLM |
| `/api/preview-angles` | POST | Get personalization angle options |
| `/api/video` | POST | Trigger HeyGen video render |
| `/api/video/[id]` | GET | Poll video status |
| `/api/translate` | POST | Translate video to 8 languages |
| `/api/transcribe` | POST | Transcribe audio via Speechmatics |
| `/api/share` | POST | Create shareable video link |
| `/api/persist` | POST | Persist HeyGen video to Backblaze B2 |
| `/api/persist/trace` | POST | Persist pipeline trace + asset manifest to B2 |
| `/api/thumbnail` | POST | Generate thumbnail via Genblaze worker (GMI Cloud) |
| `/api/live/session` | POST | Create a short-lived live session (Synthesia/LiveKit primary, Anam fallback) with durable lifecycle record; returns a provider-tagged token union |
| `/api/live/sync` | POST | Reconcile a browser terminal event using a per-session sync token |
| `/api/live/expire` | POST | Secret-protected scheduled expiry/reconciliation for stale sessions |
| `/api/live/availability` | GET/PATCH | Explicit sender availability (`callAvailabilityUntil`); GET with `?shareId` returns public `{acceptingCalls, callRequestsEnabled}` |
| `/api/live/call-requests` | POST/GET | Recipient creates a call request (availability-gated, rate-limited, hashed capability token); owner lists workspace requests plus a frozen-module summary scoped to the latest 50 |
| `/api/live/call-requests/[id]` | GET/PATCH | Recipient polls status (Bearer proof) or owner views; owner PATCHes `accept`/`decline` (versioned CAS; accept claims before creating its unique room) |
| `/api/live/call-requests/[id]/join` | POST | Mint scoped LiveKit participant tokens (recorded `ownerIdentity`/`recipientIdentity`) for an accepted, `roomReady`, nonexpired request; TTL ≤ 60s and ≤ request expiry |
| `/api/live/call-requests/[id]/presence` | POST | Server-observed room presence: REST `listParticipants` matched against exact recorded identities; CAS-merged via the frozen `call-connection` module; rate-limited |
| `/api/live/call-requests/[id]/cancel` | POST | Cancel via recipient capability proof or owner action; idempotent on repeat; tears the room down through the shared lifecycle path |
| `/api/live/call-requests/webhook` | POST | Signed LiveKit webhook (`WebhookReceiver`, auth mandatory); reconciles presence, terminalizes on `room_finished`, removes stragglers joining a terminal room |
| `/api/live/agent/chat/completions` | POST | Internal worker gateway — authenticated (`NUNCIO_LIVE_WORKER_TOKEN` + `x-nuncio-live-session`), server-built prompt, ignores client system messages |
| `/api/agent/handoffs` | POST/GET | Agent-token workspace (explicit `NUNCIO_AGENT_WORKSPACE_ID`, no fallback) creates a private handoff invitation — a `livelink` share carrying only a `handoffId` marker plus a private `HandoffRecord` (token hash + bounded summary context, never transcripts/contacts). GET lists redacted workspace handoffs |
| `/api/agent/handoffs/[id]` | GET/DELETE | Scoped status/context/options plus the share's recent call requests (latest-50 cohort); DELETE monotonically revokes the invitation — blocks future entry/session/LLM access, does not force-end connected calls |
| `/api/agent/call-requests` | GET | Owner-agent polling inbox: safe projection (ids/status/recipient name/handoff context/dashboard URL), no tokens or contact data; pull only — no push channel |
| `/api/live/handoffs/[shareId]/access` | POST | Bearer-invite → per-share HttpOnly cookie exchange (`nuncio_handoff_<shareId>`, same-origin JSON POST, rate-limited, idempotent); cookie maxAge bounded by the invite's remaining life |

---

## Data Flow

```
User input (URL + brief)
        │
        ├── TinyFish ──→ { enrichment markdown }
        │
        ├── LLM synthesis ──→ { profile, script }
        │
        ├── ElevenLabs ──→ { soundscape, cinematic entrance }
        │
        ├── HeyGen ──→ { video URL }                         [video mode]
        │
        ├── Synthesia/LiveKit ──→ { LiveKit participant token } [livelink, primary]
        ├── Anam ──→ { short-lived live session token }       [livelink, fallback]
        │
        ├── Backblaze B2 ──→ { durable media storage + asset manifest, served via presigned URLs }
        │
        ├── Grove ──→ { immutable provenance proof }
        │
        └── Share store ──→ { /v/[id] landing page }
```

---

## Error States

| Stage | Failure | Recovery |
|-------|---------|---------|
| TinyFish | Login wall / 403 | Skip URL, continue with remaining |
| TinyFish | API auth/quota (401/403) | `TinyFishApiError` thrown — warning surfaced to user, auto-render blocked on low confidence |
| TinyFish | Rate limit (429) | `TinyFishApiError` thrown — warning surfaced, research quality downgraded |
| TinyFish | Unavailable (5xx) | `TinyFishApiError` thrown — warning surfaced |
| LLM | Rate limit | Provider fallback (Anthropic → Google → Featherless → Venice → TokenRouter) |
| HeyGen Video Agent | API unavailable | Fallback to direct `/v3/videos` |
| HeyGen | Timeout (>10 min) | Surface error, preserve script |
| Synthesia/LiveKit | Missing configuration, dispatch failure, or avatar wait timeout | Confirm room cleanup, then attempt Anam once on the same session/reservation; ambiguous cleanup fails safe |
| Anam | Missing configuration or token failure | Safe configuration/502 error and reservation refund when applicable |
| Live provider/WebRTC | Connection, mobile, or provider failure | Lifecycle error is recorded; provider failure or repeated connection failure falls back to `/v/[id]`; mic denial stays as an in-page recovery state |
| Speechmatics | Transcription fails | Non-blocking, text-only |

---

## Research Quality

The pipeline assesses research confidence *before* the user spends a render credit. This prevents the “wasted credit on bad research” problem when TinyFish is degraded or a Twitter link yields only thin tweet snippets.

### Quality Assessment

`assessResearchQuality()` in `src/lib/pipeline/steps.ts` evaluates:
- **Source count** — how many enriched markdown sources contributed
- **Recent post count** — how many recent-activity posts were found
- **Search fallback used** — whether TinyFish fetch failed and search was used instead
- **API warnings** — `TinyFishApiError` messages collected during research

### Confidence Levels

| Confidence | Criteria | Behavior |
|-----------|----------|----------|
| `high` | 3+ sources, recent activity found, no API warnings | Normal flow |
| `medium` | 1-2 sources, or search fallback used, no API errors | Subtle warning shown |
| `low` | API errors, or single source via search fallback with zero recent activity | **Auto-render blocked**, amber warning banner, user must review and manually render |

### SSE Events

The pipeline emits a `research_quality` phase event immediately after synthesis, so the studio client can display the warning *before* the script is even generated:

```
data: {"phase":"research_quality","researchQuality":{"confidence":"low","sourceCount":1,...}}
```

### Agent Mode

In the autonomous Hermes agent (`/api/agent/prospect-queue`), low-confidence profiles skip auto-render and get `needsReview: true` in the result — flagging them for human review in hybrid mode.

### Twitter/X De-biasing

Twitter links are particularly prone to mischaracterization because:
1. X serves a login wall to scrapers (fetch returns junk)
2. Search fallback returns tweet snippets, which are ephemeral hot-takes
3. 1-2 tweets can dominate the LLM’s characterization

Mitigations in `src/lib/tinyfish.ts`:
- **Identity-first search**: runs a `-site:x.com` query *before* tweet searches, so LinkedIn bios, GitHub READMEs, and personal sites are found first
- **Tweet cap**: tweet search results are capped at 5 so they can’t overwhelm identity data
- **Synthesis prompt**: explicitly instructs the LLM to weight stable sources (LinkedIn, GitHub, personal sites) over individual tweets, and to mark confidence as `low` when data is thin
- **Activity before synthesis**: `fetchRecentActivity()` now runs *before* `synthesise()`, so the LLM sees the full picture (identity + recent posts) before committing to a characterization

## Delivery Modes

The pipeline is intentionally agnostic to the final delivery format. A single `deliveryMode` field routes the output:

| Mode | Output | Render Layer |
|------|--------|--------------|
| `video` | MP4 + share page | HeyGen |
| `livelink` | Real-time avatar session | Synthesia Interactive Avatar via customer-owned LiveKit room (primary) / Anam (fallback) / HeyGen recorded video (artifact fallback) |

Shared steps (research, synthesis, script/playbook generation) stay the same. Only the final render step changes.

## LiveLink rollout architecture

LiveLink is an additive delivery mode, not a replacement for the recorded-video path.

- **Shared context:** research, synthesis, script, Sender Playbook, language, and recipient context are generated once and reused by either mode.
- **Provider boundary:** `/api/live/session` returns a discriminated union — `{provider:"synthesia", serverUrl, participantToken, roomName}` or `{provider:"anam", sessionToken}` — and the live page handles both. `NUNCIO_LIVE_PRIMARY_PROVIDER` (`synthesia` | `anam`, default `synthesia`) picks the primary; a cleanly-cleaned-up **Synthesia** start failure falls back once to **Anam** on the same reservation/session record (there is no fallback after Anam — it is the terminal provider). If cleanup cannot be confirmed, no fallback is launched (avoids double-paid sessions) and a safe error is returned.
- **Synthesia path:** server creates room `nuncio-live-<sessionId>` (`src/lib/livekit.ts`), explicitly dispatches the `nuncio-synthesia` LiveKit agent with `{sessionId, avatarId, voiceId}` metadata, and waits ≤60s for the avatar video participant before minting the recipient's participant token. `SYNTHESIA_API_KEY` lives only in the Python worker (`workers/live-avatar/agent.py`), never on the Next server. LiveKit transport is metered in addition to Synthesia minutes.
- **Worker gateway:** the worker's LLM calls `POST /api/live/agent/chat/completions` with `NUNCIO_LIVE_WORKER_TOKEN` + `x-nuncio-live-session`. The route rebuilds the authoritative system prompt server-side from share+workspace (`src/lib/live-prompt.ts`), ignores any client-supplied system/developer messages, bounds message count/size, and returns an OpenAI chat-completions shape (stream requests get a single chunk — the upstream call is non-streaming).
- **Human call bridge:** durable `CallRequestRecord` (file + Turso providers) models recipient → owner call requests. One open request per share; pending expires at 2min, accepted at 10min (UI safety limits). Every record carries a `version` and all domain writes are versioned CAS (`COALESCE(json_extract(version),0)` on Turso, serialized lock on file). Accept claims the request first — recording `ownerIdentity`, `recipientIdentity`, and a unique per-attempt room name (`nuncio-call-<id>-<uuid>`, or a reused open Synthesia twin room whose recipient identity stays `guest-<sessionId>`) — then the winner alone creates its candidate room and flips `roomReady`; racing accepts can never share a room and a loser deletes nothing. Cancel/decline/expiry/cron share one idempotent cleanup path that removes known participants, deletes the room only when `hasAcceptedRoom` says no live accept protects it, and persists `roomClosedAt` only after confirmed absence (`cleanupError` flags ambiguity for the next cron pass). Owner joins via scoped LiveKit tokens; "joined" means server-observed exact-identity presence (`/presence` heartbeat + signed webhook), never acceptance — observed timestamps can lag real connect/disconnect, so they are not an exact physical connect time. An accepted call may reuse the Synthesia room — the worker silences and removes its avatar on real `owner-*` presence and tolerates a recipient reconnect grace — and the room is never deleted while an accepted call is active. Direct human calls create no avatar credits reservation.
- **Feature control:** `NUNCIO_LIVELINK_ENABLED=true` is necessary but insufficient: `NUNCIO_LIVELINK_WORKSPACE_IDS` and/or `NUNCIO_LIVELINK_SENDER_EMAILS` must explicitly allowlist the pilot. The gate fails closed when both lists are empty.
- **Session safety:** the browser enforces a five-minute maximum and cleans up the SDK client/timer on manual end, provider disconnect, unload, and unmount. Each token has a durable session record and hashed sync token; `/api/live/expire` reconciles stale records when invoked by a scheduler.
- **Identity and safety:** the live page discloses that the prospect is speaking with an AI avatar; the server-built prompt enforces the Sender Playbook for pricing, claims, commitments, and competitor statements; booking uses the configured link rather than implied promises.
- **Fallback:** if LiveLink cannot start or repeatedly fails to connect, the page redirects to the recorded share at `/v/[id]`; microphone denial remains an explicit in-page recovery path.
- **Text→live handoff (untested this pass):** an agent-created invitation (`POST /api/agent/handoffs`) produces a private share whose only public trace is a `handoffId` marker. The invite token travels in the `#handoff=` URL fragment, is stripped before the handoff fetch/telemetry, and is exchanged into an HttpOnly cookie carrying the raw bearer token (`src/lib/live-handoff-client.ts`). `authorizeHandoffShare` (`src/lib/live-handoff.ts`) gates share GET, session start, availability, and call-request creation; `callRequestShareStillValid` re-checks activity so revoke/expiry blocks fresh joins while cancel/webhook cleanup still work. An active handoff's compact context is appended to the server-built twin prompt as untrusted data; the owner inbox shows it as "Text conversation context". The invite URL is a forwardable bearer capability — it does not verify recipient identity and is never single-use-claimed.
- **Usage accounting:** the route reserves the five-credit pilot maximum. Provider-start failures refund the reservation; browser-reported duration is retained as telemetry but is not trusted to reduce billing. Stale expiry is conservative and keeps the maximum charge because Anam does not expose a server-authoritative duration endpoint.
- **Telemetry:** the browser emits PostHog requested, connected, ended (duration/reason), and failed events; the server stores terminal duration and reason without raw audio. Provider-authoritative duration and meeting outcome remain future work.

### Cross-cutting rollout concerns

### Retry Logic
All external API calls use exponential backoff with configurable max attempts.

### LLM Provider Chain
`Anthropic Claude` → `Featherless AI`. Auto-selects based on available keys.

### Storage Providers
- `FileShareStorageProvider` / `TursoShareStorageProvider` — share records
- `FileLiveSessionStorageProvider` / `TursoLiveSessionStorageProvider` — durable twin-session lifecycle records
- `FileCallRequestStorageProvider` / `TursoCallRequestStorageProvider` — versioned call-request records and room-cleanup state
- `FileHandoffStorageProvider` / `TursoHandoffStorageProvider` — private handoff invitations (serialized file writes via temp+rename / atomic scoped SQL revoke; `revokedAt` is monotonic). The file provider assumes a single process — it keeps a conservative in-memory revoke on persist failure, which must be retried since a restart would lose it; use Turso for production.

### Three-Tier Media Storage
Media assets and provenance are separated by role with zero overlap:

| Tier | Provider | Role |
|------|----------|------|
| Media assets | Backblaze B2 | Videos, audio, thumbnails, traces, per-share asset manifests; S3 user-defined metadata |
| Provenance | Grove | Immutable proof v2 records: content hashes, Genblaze manifest URIs, model versions |
| Orchestration | Genblaze worker | Multi-step pipelines across ElevenLabs + GMI Cloud (see `workers/genblaze/`) |

B2 and Genblaze are opt-in (`B2_*` and `GENBLAZE_WORKER_URL` env vars) and non-blocking: absence falls back to direct provider calls and raw URLs.

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/studio` | Video builder |
| `/v/[id]` | Video share page |
| `/live/[id]` | Live avatar conversation page (Synthesia via LiveKit or Anam; recipient call-request panel) |
| `/playbook` | Usage examples |