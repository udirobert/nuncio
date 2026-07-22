# nuncio

> The conversational SDR that looks and sounds like you.

nuncio is an AI sales agent for founders and small B2B teams pursuing high-value accounts, partnerships, investors, and other conversations where one thoughtful first message can change the relationship.

We start with a personalised video because it is the best hook in the world. The real product is a live, conversational AI avatar of the sender — trained on their face, voice, and playbook — that can talk to prospects, answer questions, and book meetings.

No templates. No mail merge. A real agent for the conversations that matter most.

---

## How it works

1. **Research** — TinyFish fetches and cleans each social profile in parallel.
2. **Ground** — Nuncio combines public context with the sender's reason, offer, and constraints.
3. **Write** — The Copywriter Agent surfaces personalization angles and drafts scripts.
4. **Review** — The sender approves the research, hook, script, and creative direction.
5. **Render** — The Producer Agent generates audio (ElevenLabs) and video (HeyGen) or prepares a live avatar session.
6. **Deliver** — The finished video or live link is served on a branded landing page (`/v/[id]`) with sharing, captions, and optional translation.

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

- **Strategic account outreach** — reach the handful of prospects that deserve real effort
- **Investor intros** — tailored videos for each LP, angel, or VC
- **Partnership conversations** — show why the relationship makes sense now
- **Recruiting** — video outreach to candidates that references their actual work
- **Founder-to-founder asks** — specific, respectful first messages that open a door

The video is the hook. The long-term goal is a live, conversational AI avatar that continues the conversation on the sender's behalf.

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
- **Sender playbook** — capture what the sender wants, can offer, and where they have wiggle room
- **Delivery modes** — recorded video today, live avatar link tomorrow

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
