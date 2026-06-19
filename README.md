# nuncio

> Send a video they'll actually watch.

nuncio is a collaborative video personalization platform where specialized AI agents research prospects, craft personalized scripts, validate compliance, and render videos—all coordinated through Band's multi-agent room.

No templates. No mail merge. A video that sounds like you wrote it for them specifically, because the agent did.

---

## How it works

1. **Research** — TinyFish fetches and cleans each social profile in parallel.
2. **Write** — The Copywriter Agent surfaces personalization angles and drafts scripts.
3. **Validate** — The QA Agent checks word counts, brand safety, and compliance.
4. **Render** — The Producer Agent generates audio (ElevenLabs) and video (HeyGen).
5. **Deliver** — The finished video is served on a branded landing page (`/v/[id]`) with sharing, captions, and optional translation.

Total time from input to video: ~5 minutes.

---

## Multi-Agent Collaboration

nuncio uses **Band** as the coordination layer. Four specialized agents work together in a shared room:

```
User joins Band Room → posts prospect URL + brief
        │
        ▼
┌───────────────────┐
│ Researcher Agent │ ← Enriches profile via TinyFish
└────────┬────────┘
         │ (structured message)
         ▼
┌───────────────────┐
│ Copywriter Agent  │ ← Generates angles + scripts via Claude/Featherless
└────────┬────────┘
         │ (drafts)
         ▼
┌───────────────────┐
│ QA Agent        │ ← Validates word count, brand safety, pronunciation
└────────┬────────┘
         │ (approved/revision request)
         ▼
┌───────────────────┐
│ Producer Agent   │ ← Renders audio (ElevenLabs) + video (HeyGen)
└────────┬────────┘
         │
         ▼
   Video link + landing page
```

Users see agent reasoning, approve angles, and track progress in real-time. Human approval required before video renders.

---

## Stack

| Layer | Technology |
|-------|----------|
| Coordination | [Band](https://band.ai) — multi-agent room |
| Enrichment | [TinyFish](https://tinyfish.ai) Fetch + Search API |
| Intelligence | [Anthropic Claude](https://anthropic.com) or [Featherless AI](https://featherless.ai) |
| Audio | [ElevenLabs](https://elevenlabs.io) — soundscape, cinematic entrance |
| Video | [HeyGen](https://heygen.com) Video Agent API, Avatar V |
| Speech | [Speechmatics](https://speechmatics.com) — captions, transcription |
| Storage | [Turso](https://turso.tech) (SQLite) + file fallback |
| Frontend | Next.js 16, TypeScript, Tailwind CSS, Motion |
| Deployment | Docker, [Vultr](https://vultr.com) + Coolify |

---

## Quickstart

```bash
git clone https://github.com/udirobert/nuncio
cd nuncio
cp .env.example .env.local
# Add your API keys to .env.local
pnpm install
pnpm dev
```

Visit `http://localhost:3000?demo=true` to see the full flow with cached data (no API keys needed).

### Environment variables

```env
# Required
TINYFISH_API_KEY=
HEYGEN_API_KEY=
HEYGEN_AVATAR_ID=
HEYGEN_VOICE_ID=

# Intelligence (at least one)
ANTHROPIC_API_KEY=
FEATHERLESS_API_KEY=

# Optional
ELEVENLABS_API_KEY=
SPEECHMATICS_API_KEY=
TURSO_DATABASE_URL=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Use cases

- **Sales outreach** — personalized video prospecting at scale
- **Investor pitches** — tailored intro videos for each LP or VC
- **Recruiting** — video outreach to candidates that references their actual work
- **Freelancer pitches** — win clients with a video that speaks to their specific situation
- **Conference follow-up** — post-event videos that reference real conversations

---

## Key features

- **Agent-driven angles** — surfaces personalization options with reasoning, lets you pick what to focus
- **Intent chips** — pick a genre (warm intro, investor pitch, hiring, conference follow-up)
- **Platform auto-detection** — paste any URL, nuncio identifies LinkedIn, Twitter/X, GitHub, etc.
- **Voice input** — record a sender brief via microphone, transcribed by Speechmatics
- **Script review** — personalization hooks highlighted inline before rendering
- **Video translation** — one-click translation to 8 languages via HeyGen Lipsync
- **Auto-captions** — generate timed subtitles via Speechmatics
- **Branded sharing** — every video link (`/v/[id]`) is a marketing surface with "Make your own" CTA
- **Demo mode** — `?demo=true` runs the full pipeline with cached data for presentations
- **LLM fallback** — auto-selects Anthropic or Featherless based on available keys

---

## Project structure

```
nuncio/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main pipeline UI
│   │   ├── playbook/page.tsx     # Worked examples
│   │   ├── v/[id]/page.tsx       # Video landing page
│   │   └── api/
│   │       ├── enrich/route.ts
│   │       ├── script/route.ts
│   │       ├── video/route.ts
│   │       └── ...
│   ├── components/
│   │   ├── url-form.tsx
│   │   ├── angle-picker.tsx
│   │   ├── script-review.tsx
│   │   └── ...
│   └── lib/
│       ├── tinyfish.ts           # Enrichment
│       ├── claude.ts            # Script generation
│       ├── heygen.ts            # Video rendering
│       ├── elevenlabs.ts        # Audio generation
│       └── pipeline.ts           # State machine
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BAND_INTEGRATION.md
│   ├── DEPLOY.md
│   └── ...
├── Dockerfile
└── .env.example
```

---

## Deployment

See [`docs/DEPLOY.md`](./docs/DEPLOY.md) for deployment guide (Vultr + Coolify, Docker, or direct VPS).

---

## License

MIT