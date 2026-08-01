# Architecture

## Overview

nuncio is a multi-agent platform for personalized outreach. The current product is video-first: agents research a prospect, draft a script, and render a personalized video. The next chapter is a **conversational SDR** — a live AI avatar of the sender that can hold a real-time conversation with the prospect.

Recorded video is the wedge. Live conversation is the product. The same research and synthesis pipeline powers both.

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
| `/api/live/session` | POST | Create a short-lived Anam LiveLink session token and durable lifecycle record |
| `/api/live/sync` | POST | Reconcile a browser terminal event using a per-session sync token |
| `/api/live/expire` | POST | Secret-protected scheduled expiry/reconciliation for stale sessions |

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
        ├── Anam ──→ { short-lived live session token }       [livelink mode]
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
| Anam | Missing configuration or token failure | Current path returns a safe error and refunds the reservation when applicable; recorded-video fallback is planned |
| Anam/WebRTC | Connection, mobile, or provider failure | Current path ends/reports the session error; lifecycle recording and recorded-share fallback are planned |
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
| `livelink` | Real-time avatar session | Anam / HeyGen LiveAvatar + WebRTC |

Shared steps (research, synthesis, script/playbook generation) stay the same. Only the final render step changes.

## LiveLink rollout architecture

LiveLink is an additive delivery mode, not a replacement for the recorded-video path.

- **Shared context:** research, synthesis, script, Sender Playbook, language, and recipient context are generated once and reused by either mode.
- **Provider boundary (planned):** the live route currently calls Anam directly; introduce provider-neutral session outcomes before adding another live provider.
- **Feature control:** `NUNCIO_LIVELINK_ENABLED=true` is necessary but insufficient: `NUNCIO_LIVELINK_WORKSPACE_IDS` and/or `NUNCIO_LIVELINK_SENDER_EMAILS` must explicitly allowlist the pilot. The gate fails closed when both lists are empty.
- **Session safety:** the browser enforces a five-minute maximum and cleans up the SDK client/timer on manual end, provider disconnect, unload, and unmount. Each token has a durable session record and hashed sync token; `/api/live/expire` reconciles stale records when invoked by a scheduler.
- **Identity and safety (planned hardening):** disclose that the prospect is speaking with an AI avatar; enforce the Sender Playbook for pricing, claims, commitments, and competitor statements; use explicit tools for booking rather than implied promises.
- **Fallback (planned):** if LiveLink cannot start or drops, show a useful recorded-video or follow-up path rather than a dead-end error. The current page shows an error/retry state.
- **Usage accounting:** the route reserves the five-credit pilot maximum. Provider-start failures refund the reservation; browser-reported duration is retained as telemetry but is not trusted to reduce billing. Stale expiry is conservative and keeps the maximum charge because Anam does not expose a server-authoritative duration endpoint.
- **Telemetry:** the browser emits PostHog requested, connected, ended (duration/reason), and failed events; the server stores terminal duration and reason without raw audio. Provider-authoritative duration and meeting outcome remain future work.

### Cross-cutting rollout concerns

### Retry Logic
All external API calls use exponential backoff with configurable max attempts.

### LLM Provider Chain
`Anthropic Claude` → `Featherless AI`. Auto-selects based on available keys.

### Storage Providers
- `FileShareStorageProvider` — default local fallback
- `TursoShareStorageProvider` — production (when `TURSO_DATABASE_URL` set)

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
| `/live/[id]` | Live avatar conversation page |
| `/playbook` | Usage examples |