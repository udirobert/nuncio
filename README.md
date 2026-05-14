# nuncio

> Drop a name or any social URL. Get a personalised video in 60 seconds.

nuncio is an agentic video personalisation pipeline. You give it a person — their LinkedIn, Twitter/X, Farcaster, Facebook, or any public profile — and it produces a short, tailored video addressed directly to them. Their name. Their actual work. Their real context. Delivered in your voice.

No templates. No mail merge. A video that sounds like you wrote it for them specifically, because the agent did.

---

## How it works

1. **Enrich** — TinyFish fetches and cleans each social profile in parallel, returning structured context across all platforms simultaneously.
2. **Synthesise** — Claude merges the enriched data into a rich profile and writes a personalised video script.
3. **Compose** — The Melius MCP agent creates a project canvas, generates supporting visuals (backgrounds, thumbnails, brand assets), and organises all creatives.
4. **Render** — HeyGen's Video Agent composes the scene via HyperFrames, renders it with Avatar V and a cloned voice, and optionally translates it via Video Translate + Lipsync.
5. **Deliver** — The finished video is stored in the Melius canvas and returned as a shareable link.

Total time from input to video: ~60 seconds.

---

## Stack

| Layer | Technology |
|---|---|
| Enrichment | [TinyFish](https://tinyfish.ai) Fetch API |
| Intelligence | [Anthropic Claude](https://anthropic.com) (claude-sonnet-4-5) |
| Creative canvas | [Melius](https://melius.com) MCP server |
| Video generation | [HeyGen](https://heygen.com) Video Agent, HyperFrames, Avatar V |
| Voice | HeyGen Voice Clone |
| Translation | HeyGen Video Translate + Lipsync |
| Frontend | Next.js 15, TypeScript, Tailwind CSS |

---

## Quickstart

```bash
git clone https://github.com/your-org/nuncio
cd nuncio
cp .env.example .env.local
pnpm install
pnpm dev
```

### Environment variables

```env
TINYFISH_API_KEY=
ANTHROPIC_API_KEY=
HEYGEN_API_KEY=
MELIUS_API_KEY=
```

---

## Use cases

- **Sales outreach** — personalised video prospecting at scale
- **Investor pitches** — tailored intro videos for each LP or VC
- **Recruiting** — video outreach to candidates that references their actual work
- **Freelancer pitches** — win clients with a video that speaks to their specific situation
- **Conference follow-up** — post-event videos that reference real conversations

---

## Hackathon entries

nuncio was built across multiple hackathons simultaneously:

- **HeyGen Hackathon** — primary showcase of HyperFrames, Avatar V, Voice Clone, and Video Translate
- **Milan AI Week / AI Agent Olympics** (lablab.ai) — agentic workflow + enterprise utility track
- **TechEx Intelligent Enterprise Solutions** (lablab.ai) — enterprise sales automation track
- **Melius Challenge** (Contra) — MCP-native creative agent demonstration

See [`hackathon.md`](./hackathon.md) for per-submission framing and pitch notes.

---

## Project structure

```
nuncio/
├── app/
│   ├── page.tsx
│   ├── result/page.tsx
│   └── api/
│       ├── enrich/route.ts
│       ├── script/route.ts
│       ├── canvas/route.ts
│       └── video/route.ts
├── lib/
│   ├── tinyfish.ts
│   ├── claude.ts
│   ├── melius.ts
│   └── heygen.ts
├── docs/
│   ├── README.md
│   ├── architecture.md
│   ├── roadmap.md
│   ├── design.md
│   └── hackathon.md
└── .env.example
```

---

## License

MIT