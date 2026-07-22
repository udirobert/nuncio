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
        ├── HeyGen ──→ { video URL }
        │
        └── Share store ──→ { /v/[id] landing page }
```

---

## Error States

| Stage | Failure | Recovery |
|-------|---------|---------|
| TinyFish | Login wall / 403 | Skip URL, continue with remaining |
| LLM | Rate limit | Provider fallback (Anthropic → Featherless) |
| HeyGen Video Agent | API unavailable | Fallback to direct `/v3/videos` |
| HeyGen | Timeout (>5 min) | Surface error, preserve script |
| Speechmatics | Transcription fails | Non-blocking, text-only |

---

## Delivery Modes

The pipeline is intentionally agnostic to the final delivery format. A single `deliveryMode` field routes the output:

| Mode | Output | Render Layer |
|------|--------|--------------|
| `video` | MP4 + share page | HeyGen |
| `livelink` | Real-time avatar session | Anam / HeyGen LiveAvatar + WebRTC |

Shared steps (research, synthesis, script/playbook generation) stay the same. Only the final render step changes.

## Cross-Cutting Concerns

### Retry Logic
All external API calls use exponential backoff with configurable max attempts.

### LLM Provider Chain
`Anthropic Claude` → `Featherless AI`. Auto-selects based on available keys.

### Storage Providers
- `FileShareStorageProvider` — default local fallback
- `TursoShareStorageProvider` — production (when `TURSO_DATABASE_URL` set)

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/studio` | Video builder |
| `/v/[id]` | Video share page |
| `/live/[id]` | Live avatar conversation page |
| `/playbook` | Usage examples |