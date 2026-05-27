# Architecture

## Overview

nuncio is a modular agentic pipeline. Each stage is a discrete API call with a clean input/output
contract. Stages are independent — they can be swapped, retried, or extended without touching
adjacent layers.

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
│  2. Claude/LLM synthesis    │  Profile merge + script generation
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  3. Hook Engine             │  Archetype selection + hook video generation
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  4. ElevenLabs soundscape   │  Generative ambience per vibe preset
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  5. HeyGen video render     │  Avatar V + voice clone
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  6. Speechmatics captions   │  Fire-and-forget transcription
└─────────────┬───────────────┘
              │
              ▼
     Shareable video link
```

### Batch mode

For multi-profile campaigns, the same pipeline runs per job in an in-memory queue:

```
POST /api/batch  ──→  createBatch()  ──→  processBatch()  ──→  enrich → script → render
                        │                      │
                        ▼                      ▼
                   queue (Map)           updateJob() per stage
```

The batch processor reuses the same library functions (enrich, synthesise, generateScript,
createVideo) as the individual Studio flow, wrapped in a per-job reservation pattern.

---

## Stage 1 — TinyFish enrichment

**Purpose:** Extract structured, clean text from any social profile URL.

**Why TinyFish:** Most social profiles are JavaScript-rendered. TinyFish runs a real browser and
returns clean markdown, stripping navigation, ads, and boilerplate. Multiple URLs are fetched in
parallel server-side.

**Cost:** Search and Fetch are free. No credits consumed on failed fetches.

See `src/lib/tinyfish.ts`.

---

## Stage 2 — LLM synthesis

**Purpose:** Merge enriched profile data into a coherent person-summary and generate a
personalised video script.

**Two-pass approach:**

*Pass 1 — profile synthesis (`synthesise()`):*
LLM receives all enriched markdown and produces a structured JSON profile.

*Pass 2 — script generation (`generateScript()`):*
LLM receives the structured profile plus a sender brief and produces a video script.

**Provider fallback chain:** Anthropic Claude → Google Gemini → Venice AI → Featherless AI.
Priority overridable via `PREFERRED_LLM_PROVIDER` env var.

**Current production:** Featherless AI (DeepSeek V4 Flash, flat-rate $25-200/mo, unlimited tokens).

See `src/lib/llm.ts` (abstraction) and `src/lib/claude.ts` (prompts).

---

## Stage 3 — Hook Engine

**Purpose:** Select a creative "hook" archetype for the video opener and generate a short
cinematic hook video.

**Five archetypes:**
1. Mirror — reflect the recipient's own content back at them
2. Origin — show how their work started or what influenced them
3. Future-cast — imagine a near-future world their work enables
4. Inside-joke — reference a specific detail only they'd recognise
5. Day-in-the-life — vignette of their daily workflow

**Format decisioning:** `pickFormat(profile)` selects 9:16 vs 16:9, captions on/off, target
duration based on profile signals.

**Hook video:** Generated via fal.ai video endpoints.

See `docs/HOOK_ENGINE.md` and `src/lib/hooks/`.

---

---

## Stage 4 — ElevenLabs soundscape

**Purpose:** Add generative ambient audio beneath the video for a cinematic feel.

**Five vibe presets:** tech-office, quiet-cafe, startup-hustle, zen-studio, city-pulse
**API:** `POST /v1/sound-generation` (sound effects) + `POST /v1/text-to-speech/{voiceId}` (TTS)
**Model:** `eleven_flash_v2_5` for TTS, standard model for sound effects

See `src/lib/elevenlabs.ts`.

---

## Stage 6 — HeyGen video render

**Purpose:** Render the final avatar video using the script, voice clone, and assets.

**Primary: Video Agent API** (`POST /v3/video-agents`, Avatar V engine, $2/min)
**Fallback:** `/v2/video/generate` (direct scene composition, $1/min)

**Sequence:**
1. Build Video Agent prompt from script + recipient name
2. Call Video Agent with prompt and config (incognito mode)
3. If Video Agent fails → fall back to v2 direct API
4. Poll status every 5s
5. On completion, return video URL

**Translation:** `POST /v1/video_translate` via HeyGen ($2/min)

See `src/lib/heygen.ts`.

---

## Stage 7 — Speechmatics captions

**Purpose:** Generate timed captions for the video.

**Fire-and-forget:** After video render completes, the audio is transcribed asynchronously and
caption segments are stored alongside the share record.

**API:** `@speechmatics/batch-client` (enhanced operating point, English)
**Cost:** Free tier includes 480 min/month

See `src/lib/speechmatics.ts`.

---

## Auth system

**Magic-link auth** (no passwords):

1. User submits email on `/login` page → `POST /api/auth/login`
2. Server creates a token (in-memory Map, 15-min expiry) and sends a Resend email with the link
3. User clicks link → `GET /api/auth/verify?token=xxx` → HMAC-signed cookie (`nuncio_account`) set
4. Cookie read by `readAccountSession()` — workspaceId, userId, email, plan, stripeCustomerId

The account menu in the header shows the signed-in user's email, plan, and credit balance.
Logout via `POST /api/auth/logout` clears the cookie.

See `src/lib/auth/session.ts` and `src/lib/auth/magic-link.ts`.

---

## Credit system

**Single currency:** Nuncio credits. Provider costs are internal — users see one balance.

**Pattern:** reserve → commit/refund

1. `reserveCredits()` — check balance meets cost, hold the amount
2. If provider accepts the job → `commitCreditReservation()` — deduct from balance
3. If provider fails → `refundCreditReservation()` — release the hold

**Credit costs:**

| Action | Cost |
|--------|-----:|
| profile.research | 1 |
| script.generate | 1 |
| canvas.build | 1 |
| soundscape.generate | 1 |
| video.render | 8 |
| video.translate | 2 |
| captions.generate | 1 |
| preview.generate | 0 |

**Enforcement:** Controlled by `NUNCIO_CREDITS_ENFORCED=true`. When off, reservations are
"shadow" — recorded but not blocked. When on, insufficient credits return 402.

**Anonymous users:** Get 10 trial credits via `ensureLedger()`. Subject is `anon:{clientIp}`.

See `src/lib/billing/credits.ts` and `docs/CREDITS.md`.

---

## API routes (Next.js App Router)

### Core pipeline

| Route | Method | Description |
|---|---|---|
| `/api/enrich` | POST | Accepts `{ urls }`, returns enriched markdown |
| `/api/script` | POST | Accepts `{ enrichment, senderBrief }`, returns `{ profile, script }` |
| `/api/soundscape` | POST | Generates ElevenLabs ambient audio from vibe/context |
| `/api/video` | POST | Triggers HeyGen render with credit reservation |
| `/api/video/[id]` | GET | Polls HeyGen status |
| `/api/translate` | POST | HeyGen video translate |
| `/api/transcribe` | POST | Speechmatics batch transcription |
| `/api/transcribe/token` | GET | Short-lived JWT for browser-side WebSocket |
| `/api/captions` | POST | Transcribe video → timed caption segments |
| `/api/voice-check` | POST | Voice clone quality assessment |
| `/api/compose` | POST | Hook + body video composition |
| `/api/gallery` | GET | List recent videos |

### Studio

| Route | Method | Description |
|---|---|---|
| `/api/studio/enrich` | POST | Enrich + script + hook + soundscape in one call (with credit enforcement) |
| `/api/studio/build` | POST | Full pipeline: enrich → script → hook → soundscape → render |
| `/api/studio/email` | POST | Email capture for share delivery |

### Batch

| Route | Method | Description |
|---|---|---|
| `/api/batch` | POST | Create and trigger a batch campaign |
| `/api/batch` | GET | List all batches |
| `/api/batch` | PATCH | Retry a failed batch |
| `/api/batch/[id]` | GET | Get single batch with all jobs |
| `/api/batch/[id]` | DELETE | Delete a batch |

### Auth

| Route | Method | Description |
|---|---|---|
| `/api/auth/login` | POST | Request magic link (sends email via Resend) |
| `/api/auth/verify` | GET | Verify token and set session cookie |
| `/api/auth/logout` | POST | Clear session cookie |
| `/api/account/session` | GET | Return current session state |

### Credits & billing

| Route | Method | Description |
|---|---|---|
| `/api/billing/balance` | GET | Current credit balance for authenticated user |
| `/api/checkout` | POST | Create Stripe checkout session |
| `/api/webhook` | POST | Stripe webhook (checkout, invoice, subscription events) |

### Other

| Route | Method | Description |
|---|---|---|
| `/api/heygen/avatars` | GET | Cached avatar list |
| `/api/heygen/voices` | GET | Cached voice list |
| `/api/cache/status` | GET | Cache hit/miss stats |
| `/api/persist` | POST | Upload video to persistent storage (Grove) |
| `/api/preview-angles` | POST | LLM-based outreach angle suggestions |
| `/api/share/[id]` | GET | Share page metadata |
| `/api/tts` | POST | ElevenLabs text-to-speech |
| `/api/videos/recent` | GET | Recent videos for authenticated workspace |
| `/api/webhook` | POST | Stripe event processing |

---

## Data flow

```
{ urls[] }
    │
    ├── TinyFish ──────────→ { markdown[] }
    │                              │
    │                       LLM synthesis
    │                              │
    │                    { profile, script }
    │                              │
    │                    Hook Engine (archetype + format + video)
    │                              │
│                    ElevenLabs soundscape
    │                              │
    │                    HeyGen render
    │                              │
    └──────────────────→ { videoUrl, captions }
```

---

## Environment variables

See [`.env.example`](../.env.example) for the complete list. Key groups:

```env
# Required
TINYFISH_API_KEY=
HEYGEN_API_KEY=
HEYGEN_AVATAR_ID=
HEYGEN_VOICE_ID=

# LLM (at least one required)
ANTHROPIC_API_KEY=
# or
GOOGLE_API_KEY=
# or
VENICE_API_KEY=
# or
FEATHERLESS_API_KEY=

# Optional but recommended
SPEECHMATICS_API_KEY=
ELEVENLABS_API_KEY=
RESEND_API_KEY=
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=

# Optional
FAL_KEY=
GROVE_ENABLED=false
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID=
NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID=
NEXT_PUBLIC_STRIPE_CREDITS_100_PRICE_ID=
NEXT_PUBLIC_STRIPE_CREDITS_500_PRICE_ID=

# Credits
NUNCIO_CREDITS_ENFORCED=true
NUNCIO_TRIAL_CREDITS=10
```

---

## Error states

| Stage | Failure mode | Recovery |
|---|---|---|
| TinyFish | Login wall / 403 on profile | Discard junk, run multi-phase search fallback. If all fail, show clear error. |
| Synthesis | Name not identifiable | Early exit with "Could not identify a person" error |
| LLM | Rate limit | Provider fallback chain (Anthropic → Google → Venice → Featherless) |
| HeyGen Video Agent | API unavailable | Automatic fallback to direct `/v2/video/generate` |
| HeyGen | Timeout (>5 min) | Surface error, preserve script for retry |
| Speechmatics | Transcription fails | Non-blocking — degrades gracefully to text-only |
| Credits | Insufficient balance | Return 402 with required/available amounts |

---

## Cross-cutting concerns

### Retry logic (`src/lib/retry.ts`)
All external API calls use `fetchWithRetry()` — exponential backoff with configurable max
attempts, initial delay, and retryable status codes (429, 500, 502, 503, 504).

### Storage providers (`src/lib/storage/`)
- `FileShareStorageProvider` — default local/Vultr fallback
- `TursoShareStorageProvider` — production metadata store
- `AccountStorageProvider` — user/workspace/credit storage (Turso)

### Rate limiting (`src/lib/rate-limit.ts`)
Per-route rate limits for `enrich`, `script`, `preview-angles`, `video`, `translate`,
`persist`, and shared limits for `script + preview-angles`.

### LLM provider chain (`src/lib/llm.ts`)
Anthropic Claude → Google Gemini → Venice AI → Featherless AI. Provider picks up if the
previous one has no API key configured. Priority overridable via `PREFERRED_LLM_PROVIDER`.

---

## Pages

| Route | Type | Description |
|---|---|---|---|
| `/` | Static | Landing page |
| `/studio` | Static | Agentic video builder (main UX) |
| `/batch` | Static | Batch campaign management |
| `/dashboard` | Static | Post-login account dashboard |
| `/login` | Static | Magic-link auth |
| `/pricing` | Static | Plan comparison + Stripe checkout |
| `/playbook` | Static | Usage guide |
| `/v/[id]` | Dynamic | Video share page |
