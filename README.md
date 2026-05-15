# nuncio

> Send a video they'll actually watch.

nuncio is an agentic video personalisation pipeline. Paste someone's LinkedIn, Twitter/X, or any public profile — and it produces a short, tailored video addressed directly to them. Their name. Their actual work. Their real context. Delivered in your voice.

No templates. No mail merge. A video that sounds like you wrote it for them specifically, because the agent did.

---

## How it works

1. **Enrich** — TinyFish fetches and cleans each social profile in parallel, with search augmentation for JS-disabled pages.
2. **Coach** — The agent surfaces 4 candidate personalisation angles from the profile, shows what it skipped and why, and lets the user pick 1–2 to focus the script.
3. **Synthesise** — The LLM (Claude or Featherless/Qwen3) merges the enriched data + selected angles + sender brief into a personalised video script.
4. **Compose** — The creative provider (Melius MCP or Fal fallback) generates supporting visuals and organises all assets in a persistent canvas.
5. **Render** — HeyGen's Video Agent composes a structured 3-scene video with Avatar V and a cloned voice, following HeyGen Skills prompt guidelines.
6. **Deliver** — The finished video is served on a branded landing page (`/v/[id]`) with sharing mechanics, captions via Speechmatics, and optional translation to 8+ languages.

Total time from input to video: ~90 seconds.

---

## Stack

| Layer | Technology |
|---|---|
| Enrichment | [TinyFish](https://tinyfish.ai) Fetch + Search API |
| Intelligence | [Featherless AI](https://featherless.ai) (Qwen3/DeepSeek) or [Anthropic Claude](https://anthropic.com) |
| Speech | [Speechmatics](https://speechmatics.com) — voice input, captions, quality check |
| Creative canvas | [Melius](https://melius.com) MCP server (with local fallback) |
| Image generation | [Fal](https://fal.ai) FLUX — creative assets when Melius is not configured |
| Video generation | [HeyGen](https://heygen.com) Video Agent API, Avatar V |
| Voice | HeyGen Voice Clone |
| Translation | HeyGen Video Translate + Lipsync |
| Analytics | [PostHog](https://posthog.com) — funnel, engagement, quality events |
| Storage | [Turso](https://turso.tech) (share records) + file fallback |
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
TINYFISH_API_KEY=
ANTHROPIC_API_KEY=          # optional if FEATHERLESS_API_KEY is set
FEATHERLESS_API_KEY=        # open-weight LLM fallback (Qwen3, DeepSeek)
HEYGEN_API_KEY=
HEYGEN_AVATAR_ID=
HEYGEN_VOICE_ID=
MELIUS_API_KEY=
FAL_KEY=
SPEECHMATICS_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
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

- **Coach Mode** — after enrichment, surfaces 4 personalisation angles with reasoning, lets you pick 1–2 to focus the script. Shows what was skipped and why.
- **Intent chips** — pick a genre (warm intro, investor pitch, hiring, conference follow-up) to get a sharper, more opinionated script
- **Platform auto-detection** — paste any URL, nuncio identifies LinkedIn, Twitter/X, GitHub, Farcaster, Facebook
- **Voice input** — record a sender brief via microphone, transcribed by Speechmatics
- **Script review** — personalisation hooks highlighted inline before rendering
- **Playbook** — 6 worked examples with teardowns of what made each one land (`/playbook`)
- **Video translation** — one-click translation to 8 languages via HeyGen Lipsync
- **Auto-captions** — generate timed subtitles via Speechmatics batch transcription
- **Voice clone quality check** — assess audio samples before cloning
- **Branded sharing** — every video link (`/v/[id]`) is a marketing surface with "Make your own" CTA
- **Credit protection** — URL validation, word count cap, rate limiting, enrichment cache
- **Demo mode** — `?demo=true` runs the full pipeline with cached data for live presentations
- **LLM fallback** — auto-selects Featherless (Qwen3) or Anthropic based on available keys

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
│   │   ├── playbook/page.tsx     # Worked examples with teardowns
│   │   ├── v/[id]/page.tsx       # Branded video landing page
│   │   └── api/
│   │       ├── enrich/route.ts
│   │       ├── preview-angles/route.ts
│   │       ├── script/route.ts
│   │       ├── canvas/route.ts
│   │       ├── video/route.ts
│   │       ├── video/[id]/route.ts
│   │       ├── translate/route.ts
│   │       ├── transcribe/route.ts
│   │       ├── transcribe/token/route.ts
│   │       ├── captions/route.ts
│   │       ├── voice-check/route.ts
│   │       └── share/route.ts
│   ├── components/
│   │   ├── url-form.tsx          # URL input with auto-detect + intent chips
│   │   ├── angle-picker.tsx      # Coach mode — angle selection
│   │   ├── progress-stepper.tsx
│   │   ├── script-review.tsx     # Inline personalisation highlighting
│   │   ├── video-player.tsx      # Translation, captions, share
│   │   ├── voice-input.tsx       # Microphone recording + Speechmatics
│   │   ├── intent-chips.tsx      # Genre selection
│   │   ├── playbook-list.tsx     # Expandable playbook cards
│   │   ├── share-nuncio.tsx      # Social share popover
│   │   └── header.tsx
│   └── lib/
│       ├── llm.ts                # LLM provider abstraction (Anthropic/Featherless)
│       ├── tinyfish.ts           # Enrichment with search fallback
│       ├── claude.ts             # Profile synthesis + script generation
│       ├── heygen.ts             # Video Agent + direct API fallback
│       ├── speechmatics.ts       # Transcription, captions, quality check
│       ├── pipeline.ts           # Pipeline orchestration + state machine
│       ├── analytics.ts          # PostHog event tracking
│       ├── playbook.ts           # Worked example data
│       ├── validation.ts         # URL + script validation
│       ├── cache.ts              # In-memory TTL cache
│       ├── rate-limit.ts         # Per-IP sliding window
│       ├── retry.ts              # Exponential backoff
│       ├── demo.ts               # Cached demo data
│       ├── melius.ts             # Creative session orchestration
│       └── creative/
│           ├── types.ts          # Provider interface
│           ├── index.ts          # Factory (auto-selects provider)
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
