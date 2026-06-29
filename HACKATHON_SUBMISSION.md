# Nuncio SDR Agent — Hermes Agent Accelerated Business Hackathon

## What it does

Nuncio is an autonomous SDR (Sales Development Representative) agent that runs the full sales-development loop without human intervention:

1. **Finds prospects** — given a URL, it researches the person and synthesizes a profile
2. **Writes personalized scripts** — generates a tailored outreach script using the prospect's background
3. **Renders video** — produces a personalized video via HeyGen
4. **Delivers outreach** — sends the video via email (Resend) with a shareable link
5. **Classifies replies** — when a prospect replies, classifies intent (interested / not_now / question / unsubscribe)
6. **Books meetings** — if interested, creates a Stripe Checkout for a consultation
7. **Reports via Telegram** — sends status updates after each cycle

The agent **earns** by closing deals ($50 per booked consultation via Stripe Checkout) and **spends** by provisioning its own services (ElevenLabs TTS, Exa search API) via Stripe Projects.

## Architecture

```
  Band agents (existing)          Hermes agent (new)
  Human-driven studio             Autonomous background
         |                              |
         v                              v
  +------------------------------------------+
  |  Shared API Layer (src/lib/pipeline/)    |
  |  research -> synthesize -> script ->     |
  |  render -> deliver                       |
  +------------------------------------------+
```

**Dual-mode architecture**: The existing human-driven studio (Band agents) and the new autonomous Hermes agent share the same pipeline step functions. No duplication — both consume `src/lib/pipeline/steps.ts`. The studio UI is untouched; the agent layer is purely additive.

## Tech stack

| Component | Technology | Role |
|-----------|-----------|------|
| Agent orchestrator | Hermes | Runs the autonomous SDR loop |
| Reasoning model | NVIDIA Nemotron 3 Ultra (550B) | Decision-making, script generation, reply classification |
| Agent API | Next.js App Router | `POST /api/agent/prospect-queue`, `POST /api/agent/reply-webhook`, `POST /api/agent/earn-checkout` |
| Spending | Stripe Projects | Agent provisions ElevenLabs TTS + Exa search API autonomously |
| Earning | Stripe Checkout | Agent creates checkout sessions for booked meetings |
| Email delivery | Resend | Sends personalized outreach emails with video links |
| Reporting | Telegram Bot | Sends cycle reports to the operator |
| Video rendering | HeyGen | Generates personalized outreach videos |
| Profile enrichment | TinyFish | Researches prospects from their URL |
| Production | Vultr (nuncio-vultr) | Deployed at nuncio.persidian.com:57913 |

## The earn / spend / operate loop

### SPENDS (agent provisions its own services)
- `stripe projects add elevenlabs/tts` — provisions ElevenLabs TTS credits for voice generation
- `stripe projects add exa/api` — provisions Exa web search API for prospect discovery
- HeyGen video rendering credits (via existing nuncio pipeline)

### EARNS (agent generates revenue)
- `POST /api/agent/earn-checkout` — creates a Stripe Checkout session for $50 consultation when a prospect replies "interested"
- The checkout URL is sent to the prospect for payment

### OPERATES (agent runs real business operations)
- Researches prospects from their public profiles
- Generates personalized outreach scripts
- Renders personalized videos
- Sends outreach emails via Resend
- Classifies email replies (interested / not_now / question / unsubscribe)
- Books meetings and collects payment
- Reports cycle status via Telegram

## Hermes skills

8 custom skills under `~/.hermes/skills/nuncio/`:

| Skill | Purpose |
|-------|---------|
| `sdr-orchestrator` | The autonomous loop blueprint (cron-scheduled 9am weekdays) |
| `nuncio-research` | Enqueue prospect via prospect-queue API |
| `nuncio-synthesize` | Profile synthesis |
| `nuncio-script` | Script generation / regeneration |
| `nuncio-render` | Video render + poll |
| `nuncio-deliver` | Multi-channel delivery (email, LinkedIn, Twitter, WhatsApp) |
| `nuncio-handle-reply` | Poll reply-webhook, classify, respond |
| `sdr-earn` | Create Stripe checkout for booked meetings |

Plus 3 official Stripe Skills: `stripe-projects`, `stripe-link-cli`, `mpp-agent`.

## Verified end-to-end results (2026-06-29)

| Step | Component | Result |
|------|-----------|--------|
| Hermes + Nemotron | Model | `nvidia/nemotron-3-ultra-550b-a55b` via build.nvidia.com |
| Stripe Projects (spend) | `stripe projects add elevenlabs/tts` | Provisioned ElevenLabs TTS credits autonomously |
| Stripe Projects (spend) | `stripe projects add exa/api` | Provisioned Exa web search API autonomously |
| Hermes SDR loop | Full autonomous cycle | 6-step loop: research -> poll -> Telegram report -> reply classification -> Stripe earn -> final Telegram report |
| Telegram gateway | @nuncioappbot | Two report messages sent (message_id 196, 197) |
| Resend email | Real outreach email | Sent to prospect with video share link |
| Stripe earn | `POST /api/agent/earn-checkout` | Stripe Checkout session created for $50 consultation |
| Production deploy | nuncio-vultr:57913 | All agent endpoints live with RESEND_API_KEY + NUNCIO_AGENT_TOKEN |

## How to run

```bash
# 1. Start nuncio server
cd /Users/udingethe/Dev/nuncio && pnpm dev

# 2. Run the autonomous SDR agent via Hermes
hermes -m nemotron -z "Run the sdr-orchestrator skill. Find a prospect at https://www.eladgil.com, research them, generate a personalized video, send a Telegram report, classify a reply, and create a Stripe checkout for $50." --toolsets "terminal" --yolo

# 3. For cron-scheduled autonomous mode (9am weekdays)
# Configure via: hermes cron
```

## What makes this a business tool

- **Real revenue**: The agent creates real Stripe Checkout sessions for booked meetings. $50 per consultation.
- **Real spending**: The agent provisions its own services via Stripe Projects (ElevenLabs, Exa). It pays for its own tools.
- **Real operations**: The agent runs the full SDR loop — research, script, video, email, reply classification, booking — without human intervention.
- **Real reporting**: The agent sends cycle reports via Telegram, so the operator can monitor performance.
- **Hybrid mode**: The agent can queue drafts for human review in the studio — best of autonomous scale + human quality control.

## Repo

- GitHub: https://github.com/udirobert/nuncio
- Production: http://nuncio.persidian.com:57913
- Commit: `296e71e` (main)
