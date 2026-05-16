# Architecture

## Overview

nuncio is a linear agentic pipeline. Each stage is a discrete API call with a clean input/output contract. Stages are independent — they can be swapped, retried, or extended without touching adjacent layers.

```
User input (URLs)
      │
      ▼
┌─────────────────────────────┐
│  1. TinyFish enrichment     │  Parallel fetch per URL → clean markdown
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  2. Claude synthesis        │  Profile merge + script generation
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  3. Melius canvas           │  MCP agent creates project + assets
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  4. HeyGen video render     │  HyperFrames + Avatar V + voice clone
└─────────────┬───────────────┘
              │
              ▼
     Shareable video link
```

---

## Stage 1 — TinyFish enrichment

**Purpose:** Extract structured, clean text from any social profile URL.

**Why TinyFish:** Most social profiles are JavaScript-rendered. TinyFish runs a real browser and returns clean markdown, stripping navigation, ads, and boilerplate. Multiple URLs are fetched in parallel server-side — a LinkedIn profile, a Twitter timeline, and a Farcaster profile can all be fetched in a single call.

**Input:** Array of profile URLs
**Output:** Array of clean markdown strings, one per URL

**API:**
```
POST https://api.fetch.tinyfish.ai
X-API-Key: $TINYFISH_API_KEY

{
  "urls": [
    "https://linkedin.com/in/username",
    "https://twitter.com/username",
    "https://warpcast.com/username"
  ]
}
```

**Error handling:** Failed URLs do not count against quota. If a platform returns a login wall, fall back gracefully — the pipeline continues with whatever profiles succeeded.

**Cost:** Free tier includes 25 URLs/minute. No credits consumed on failed fetches.

---

## Stage 2 — Claude synthesis

**Purpose:** Merge enriched profile data into a coherent person-summary and generate a personalised video script.

**Two-pass approach:**

*Pass 1 — profile synthesis:*
Claude receives all enriched markdown and produces a structured JSON profile:
```json
{
  "name": "...",
  "current_role": "...",
  "company": "...",
  "notable_work": ["..."],
  "interests": ["..."],
  "tone": "formal | conversational | technical",
  "personalization_hooks": ["specific things to reference in the script"]
}
```

*Pass 2 — script generation:*
Claude receives the structured profile plus a brief about the sender (who you are, what you want to say, the call to action) and produces a 45–90 second video script. The script references specific real things about the person — not generic openers.

**Model:** `claude-sonnet-4-5`
**Input:** Raw enrichment markdown + sender brief
**Output:** Structured profile JSON + final script string

**System prompt contract:**
- Respond only in the requested JSON format
- Reference at least 2 specific details from the enriched profile in the script
- Keep the script under 200 words (avatar delivery time)
- Do not fabricate credentials or claims not present in the enrichment data

---

## Stage 3 — Melius canvas

**Purpose:** Organise the creative output into a persistent, downloadable project canvas via the Melius MCP server.

**Agent actions (in order):**

1. `project_create` — create a new project named after the target person
2. `canvas_create` — create a canvas called "nuncio session"
3. `canvas_plan_layout` — compute node positions to avoid overlaps
4. `bulk_create_nodes` — create nodes for: script text, profile summary, background image prompt, thumbnail prompt
5. `bulk_run_start` — trigger generation on image/video nodes
6. `bulk_run_wait` — poll until all nodes are complete
7. `bulk_run_download` — download generated assets
8. `creative_download` — export full canvas as ZIP for HeyGen

**MCP server URL:** `https://api.melius.com/mcp`

**Why this stage matters:** Melius persists all generated assets so they can be reused, iterated on, or handed off. If HeyGen generation fails, assets are not lost. The canvas also serves as an audit log of the full creative session.

**Guide used:** `get_guide("ugc-ads")` — informs node structure and layout for short-form video creative.

---

## Stage 4 — HeyGen video render

**Purpose:** Render the final avatar video using the script, voice clone, and Melius-generated visual assets.

**Primary: Video Agent API** (`POST /v1/video_agent/generate`)

The Video Agent is HeyGen's high-level endpoint for agentic workflows. We send a structured scene prompt following HeyGen Skills guidelines, and the agent handles avatar selection, scene composition, and rendering.

**Prompt structure (built by `buildVideoAgentPrompt()`):**
```
Scene 1 — INTRO (3s): Avatar looks at camera, begins naturally
Scene 2 — MAIN MESSAGE (variable): Delivers the personalised script
Scene 3 — CLOSE (3s): Natural ending, smile

Global style: warm, conversational, high expressiveness, 1080p 16:9
```

**Fallback: Direct API** (`POST /v3/videos`)

If the Video Agent is unavailable (rate limit, downtime), the system falls back to the direct video creation endpoint with manual avatar_id, voice_id, and background configuration.

**Sequence:**

1. Build structured Video Agent prompt from script + recipient name
2. Call `POST /v1/video_agent/generate` with prompt and config
3. If Video Agent fails → fall back to `POST /v3/videos` with manual params
4. Poll status: `GET /v1/video_status.get?video_id={id}` every 5 seconds
5. On `status === "completed"`, return `video_url`
6. Optional: `POST /v1/video_translate` for multilingual delivery (8 languages)

**Avatar:** Avatar V (launched May 18 2026). Avatar ID stored as env var.

**Voice:** Pre-clone the sender's voice once via `POST /v1/voice_clone`. Store the `voice_id` as an environment variable.

**Translation:**
```
POST /v1/video_translate
{
  "video_id": "<generated_video_id>",
  "target_language": "es"  // es, fr, de, pt, ja, zh, ar, hi
}
```

---

## API routes (Next.js)

| Route | Method | Description |
|---|---|---|
| `/api/enrich` | POST | Accepts `{ urls: string[] }`, returns enriched markdown per URL |
| `/api/script` | POST | Accepts `{ enrichment: string[], senderBrief: string }`, returns `{ profile, script }` |
| `/api/canvas` | POST | Accepts `{ profile, script }`, creates creative session, returns `{ canvasId, assetUrls }` |
| `/api/video` | POST | Accepts `{ script, assetUrls, recipientName }`, triggers HeyGen Video Agent, returns `{ videoId }` |
| `/api/video/[id]` | GET | Polls HeyGen for video status, returns `{ status, videoUrl? }` |
| `/api/translate` | POST | Accepts `{ videoId, targetLanguage }`, triggers HeyGen Video Translate |
| `/api/transcribe` | POST | Accepts audio file (multipart), returns `{ transcript, confidence, words }` via Speechmatics |
| `/api/transcribe/token` | GET | Returns short-lived JWT for browser-side Speechmatics WebSocket |
| `/api/captions` | POST | Accepts `{ videoUrl }`, transcribes video and returns timed caption segments |
| `/api/voice-check` | POST | Accepts audio file, returns voice clone quality assessment |

---

## Data flow

```
{ urls[] }
    │
    ├── TinyFish ──→ { markdown[] }
    │                      │
    │               Claude synthesis
    │                      │
    │              { profile, script }
    │                      │
    │            Melius MCP agent
    │                      │
    │         { canvasId, assetUrls[] }
    │                      │
    │              HeyGen render
    │                      │
    └──────────────→ { videoUrl, canvasUrl }
```

---

## Environment variables

```env
# TinyFish
TINYFISH_API_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Featherless fallback / premium model selection
FEATHERLESS_API_KEY=
FEATHERLESS_MODEL=deepseek-ai/DeepSeek-V4-Flash
FEATHERLESS_TIMEOUT_MS=15000

# HeyGen
HEYGEN_API_KEY=
HEYGEN_AVATAR_ID=
HEYGEN_VOICE_ID=

# Melius (optional — local fallback if not set)
MELIUS_API_KEY=

# Fal (optional — image generation fallback when Melius is not set)
FAL_KEY=
FAL_IMAGE_MODEL=fal-ai/flux/schnell

# Speechmatics
SPEECHMATICS_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NUNCIO_DATA_DIR=.data

# Durable share metadata (optional; file storage is fallback)
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=

# Grove public proof publishing (optional, redacted proof bundles only)
GROVE_ENABLED=false
GROVE_API_URL=https://api.grove.storage
GROVE_CHAIN_ID=37111
```

---

## Error states

| Stage | Failure mode | Recovery |
|---|---|---|
| TinyFish | Login wall / 403 on profile | Skip that URL, continue with remaining profiles. Show warning in UI. |
| Claude | Rate limit | Retry with exponential backoff (max 3 attempts) |
| Melius | Canvas creation fails | Fall through to local provider — pipeline continues without Melius |
| HeyGen Video Agent | API unavailable | Automatic fallback to direct `/v3/videos` API |
| HeyGen | Video generation timeout (>5 min) | Surface error to user, preserve script for retry |
| HeyGen | Invalid avatar/voice ID | Validate IDs on startup, fail fast with clear error message |
| Speechmatics | Transcription fails | Non-blocking — voice input degrades gracefully to text-only |

---

## Cross-cutting concerns

### Retry logic (`src/lib/retry.ts`)

All external API calls use `fetchWithRetry()` — exponential backoff with configurable max attempts, initial delay, and retryable status codes (429, 500, 502, 503, 504).

### Creative provider abstraction (`src/lib/creative/`)

The Melius integration is behind a `CreativeProvider` interface:
- `MeliusProvider` — full MCP integration (project, canvas, nodes, generation, export)
- `LocalProvider` — metadata fallback, optionally generating images through Fal when `FAL_KEY` is set

Factory auto-selects based on whether `MELIUS_API_KEY` is configured. No vendor lock-in.

### Speechmatics integration (`src/lib/speechmatics.ts`)

- **Voice input** — sender brief via microphone recording → batch transcription
- **Video captions** — transcribe rendered video → timed subtitle segments
- **Voice clone quality check** — assess audio sample confidence, detect noise/silence issues
- **Realtime token** — JWT generation for browser-side WebSocket connections

### Storage providers (`src/lib/storage/`)

Share metadata and proof publishing are separate concerns:

- `FileShareStorageProvider` — default local/Vultr fallback using `NUNCIO_DATA_DIR/share-records.json`.
- `TursoShareStorageProvider` — production metadata store when `TURSO_DATABASE_URL` is set.
- `GroveProofStorageProvider` — optional public, redacted proof-bundle publishing when `GROVE_ENABLED=true`.

Full share records stay in the share metadata store. Grove proof bundles intentionally omit private script/profile detail and publish only redacted workflow evidence.

---

## Stripe integration (`/api/checkout`, `/api/webhook`)

For future monetization:
- `/api/checkout` — creates Stripe Checkout sessions for subscriptions
- `/api/webhook` — handles `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`
- Share records track `plan` (`"free"` | `"pro"`), `stripeCustomerId`, `stripeSubscriptionId`
- Privacy defaults to `"public"` for free users, `"private"` for pro (pending config)

Required env vars (not yet configured):
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_MONTHLY_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID`