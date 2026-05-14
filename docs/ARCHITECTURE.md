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

**Sequence:**

1. Upload Melius background asset to HeyGen: `POST /v1/asset` → `asset_id`
2. Create video: `POST /v3/videos`
3. Poll status: `GET /v3/videos/{video_id}` every 5 seconds
4. On `status === "completed"`, return `video_url`
5. Optional: `POST /v1/video_translate` for multilingual delivery

**Create video payload:**
```json
{
  "type": "avatar",
  "avatar_id": "<your_avatar_id>",
  "script": "<generated_script>",
  "voice_id": "<cloned_voice_id>",
  "background": {
    "type": "asset",
    "asset_id": "<melius_background_asset_id>"
  },
  "resolution": "1080p",
  "aspect_ratio": "16:9",
  "expressiveness": "high",
  "callback_url": "<optional_webhook>"
}
```

**Avatar:** Avatar V (launched May 18 2026) — use `model_list` on the HeyGen API to confirm the Avatar V `avatar_id`.

**Voice:** Pre-clone the sender's voice once via `POST /v1/voice_clone`. Store the `voice_id` as an environment variable. All generated videos use this voice.

**Async handling:** HeyGen generation takes 60–180 seconds. In production use the `callback_url` webhook. For the hackathon demo, client-side polling every 5 seconds with a progress indicator is sufficient.

**Translation (optional, post-MVP):**
```
POST /v1/video_translate
{
  "video_id": "<generated_video_id>",
  "target_language": "es"  // or any supported language
}
```

---

## API routes (Next.js)

| Route | Method | Description |
|---|---|---|
| `/api/enrich` | POST | Accepts `{ urls: string[] }`, returns enriched markdown per URL |
| `/api/script` | POST | Accepts `{ enrichment: string[], senderBrief: string }`, returns `{ profile, script }` |
| `/api/canvas` | POST | Accepts `{ profile, script }`, creates Melius canvas, returns `{ canvasId, assetUrls }` |
| `/api/video` | POST | Accepts `{ script, assetUrls }`, triggers HeyGen, returns `{ videoId }` |
| `/api/video/[id]` | GET | Polls HeyGen for video status, returns `{ status, videoUrl? }` |

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

# HeyGen
HEYGEN_API_KEY=
HEYGEN_AVATAR_ID=
HEYGEN_VOICE_ID=

# Melius
MELIUS_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Error states

| Stage | Failure mode | Recovery |
|---|---|---|
| TinyFish | Login wall / 403 on profile | Skip that URL, continue with remaining profiles |
| Claude | Rate limit | Retry with exponential backoff (max 3 attempts) |
| Melius | Canvas creation fails | Log and continue — Melius is an enhancement, not a blocker |
| HeyGen | Video generation timeout (>5 min) | Surface error to user, preserve script for retry |
| HeyGen | Invalid avatar/voice ID | Validate IDs on startup, fail fast with clear error message |