# nuncio

> Send a video they'll actually watch.

nuncio is an agentic video personalisation pipeline. Paste someone's LinkedIn, Twitter/X, or any public profile — and it produces a short, tailored video addressed directly to them. Their name. Their actual work. Their real context. Delivered in your voice.

No templates. No mail merge. A video that sounds like you wrote it for them specifically, because the agent did.

---

## How it works

1. **Enrich** — TinyFish fetches and cleans each social profile in parallel, returning structured context across all platforms simultaneously.
2. **Synthesise** — Claude merges the enriched data into a rich profile and writes a personalised video script. Optionally accepts a voice-recorded sender brief via Speechmatics transcription.
3. **Compose** — The creative provider (Melius MCP or local fallback) generates supporting visuals and organises all assets.
4. **Render** — HeyGen's Video Agent composes a structured 3-scene video with Avatar V and a cloned voice, following HeyGen Skills prompt guidelines.
5. **Deliver** — The finished video is served on a branded landing page (`/v/[id]`) with sharing mechanics and optional translation to 8+ languages.

Total time from input to video: ~90 seconds.

---

## Stack

| Layer | Technology |
|---|---|
| Enrichment | [TinyFish](https://tinyfish.ai) Fetch API |
| Intelligence | [Anthropic Claude](https://anthropic.com) (claude-sonnet-4-5) |
| Speech | [Speechmatics](https://speechmatics.com) — voice input, captions, quality check |
| Creative canvas | [Melius](https://melius.com) MCP server (with local fallback) |
| Video generation | [HeyGen](https://heygen.com) Video Agent API, Avatar V |
| Voice | HeyGen Voice Clone |
| Translation | HeyGen Video Translate + Lipsync |
| Frontend | Next.js 16, TypeScript, Tailwind CSS, Motion |
| Deployment | Docker, Vultr + Coolify |

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
TINYFISH_API_KEY=
ANTHROPIC_API_KEY=
HEYGEN_API_KEY=
HEYGEN_AVATAR_ID=
HEYGEN_VOICE_ID=
MELIUS_API_KEY=
SPEECHMATICS_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Use cases

- **Sales outreach** — personalised video prospecting at scale
- **Investor pitches** — tailored intro videos for each LP or VC
- **Recruiting** — video outreach to candidates that references their actual work
- **Freelancer pitches** — win clients with a video that speaks to their specific situation
- **Conference follow-up** — post-event videos that reference real conversations

---

## Key features

- **Platform auto-detection** — paste any URL, nuncio identifies LinkedIn, Twitter/X, GitHub, Farcaster, Facebook
- **Voice input** — record a sender brief via microphone, transcribed by Speechmatics
- **Script review** — personalisation hooks highlighted inline before rendering
- **Video translation** — one-click translation to 8 languages via HeyGen Lipsync
- **Auto-captions** — generate timed subtitles via Speechmatics batch transcription
- **Voice clone quality check** — assess audio samples before cloning
- **Branded sharing** — every video link (`/v/[id]`) is a marketing surface with "Make your own" CTA
- **Demo mode** — `?demo=true` runs the full pipeline with cached data for live presentations

---

## Hackathon entries

nuncio was built across multiple hackathons simultaneously:

- **HeyGen Hackathon** — Video Agent API, Avatar V, Voice Clone, Video Translate
- **Milan AI Week / AI Agent Olympics** (lablab.ai) — agentic workflow + enterprise utility
- **TechEx Intelligent Enterprise Solutions** (lablab.ai) — enterprise sales automation
- **Melius Challenge** (Contra) — MCP-native creative agent demonstration

See [`docs/HACKATHON.md`](./docs/HACKATHON.md) for per-submission framing and pitch notes.

---

## Project structure

```
nuncio/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main pipeline UI (state machine)
│   │   ├── v/[id]/page.tsx       # Branded video landing page
│   │   └── api/
│   │       ├── enrich/route.ts
│   │       ├── script/route.ts
│   │       ├── canvas/route.ts
│   │       ├── video/route.ts
│   │       ├── video/[id]/route.ts
│   │       ├── translate/route.ts
│   │       ├── transcribe/route.ts
│   │       ├── transcribe/token/route.ts
│   │       ├── captions/route.ts
│   │       └── voice-check/route.ts
│   ├── components/
│   │   ├── url-form.tsx
│   │   ├── progress-stepper.tsx
│   │   ├── script-review.tsx
│   │   ├── video-player.tsx
│   │   ├── voice-input.tsx
│   │   ├── share-nuncio.tsx
│   │   └── header.tsx
│   └── lib/
│       ├── tinyfish.ts
│       ├── claude.ts
│       ├── heygen.ts
│       ├── speechmatics.ts
│       ├── pipeline.ts
│       ├── demo.ts
│       ├── retry.ts
│       ├── melius.ts
│       └── creative/
│           ├── types.ts
│           ├── index.ts
│           ├── melius-provider.ts
│           └── local-provider.ts
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DESIGN.md
│   ├── ROADMAP.md
│   ├── HACKATHON.md
│   └── DEPLOY.md
├── Dockerfile
└── .env.example
```

---

## Deployment

See [`docs/DEPLOY.md`](./docs/DEPLOY.md) for full deployment guide (Vultr + Coolify, Docker, or direct VPS).

---

## License

MIT
