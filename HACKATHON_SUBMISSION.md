# Nuncio SDR Agent — Hermes Agent Accelerated Business Hackathon

> NVIDIA × Stripe × NousResearch — building agents that earn, spend, and run real operations.

## What it does

Nuncio is an autonomous SDR (Sales Development Representative) agent that runs the full sales-development loop without human intervention:

1. **Finds prospects** — given a URL, it researches the person and synthesizes a profile
2. **Writes personalized scripts** — generates a tailored outreach script using the prospect's background
3. **Renders video** — produces a personalized video via HeyGen
4. **Delivers outreach** — sends the video via email (Resend) with a shareable HTTPS link
5. **Classifies replies** — when a prospect replies, classifies intent (interested / not_now / question / unsubscribe)
6. **Books meetings** — if interested, creates a Stripe Checkout for a consultation
7. **Reports via Telegram** — sends status updates after each cycle

The agent **earns** by closing deals ($50 per booked consultation via Stripe Checkout in live mode) and **spends** by provisioning its own services (ElevenLabs TTS, Exa search API) via Stripe Projects.

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
| Earning | Stripe Checkout (live mode) | Agent creates checkout sessions for booked meetings |
| Email delivery | Resend | Sends personalized outreach emails with video links |
| Inbound replies | Resend Inbound + reply-webhook | Receives and classifies prospect replies |
| Reporting | Telegram Bot (@nuncioappbot) | Sends cycle reports to the operator |
| Video rendering | HeyGen | Generates personalized outreach videos |
| Profile enrichment | TinyFish | Researches prospects from their URL |
| Data persistence | Turso (SQLite at the edge) | Share records, billing accounts, workspace data |
| Production | Vultr + Coolify + Traefik | Deployed at https://nuncio.persidian.com with automatic Let's Encrypt |

## The earn / spend / operate loop

### SPENDS (agent provisions its own services)
- `stripe projects add elevenlabs/tts` — provisions ElevenLabs TTS credits for voice generation
- `stripe projects add exa/api` — provisions Exa web search API for prospect discovery
- HeyGen video rendering credits (via existing nuncio pipeline)

### EARNS (agent generates revenue)
- `POST /api/agent/earn-checkout` — creates a live Stripe Checkout session for $50 consultation when a prospect replies "interested"
- Reuses existing Stripe customers by email lookup — repeat prospects get a unified payment history
- Idempotency keys prevent duplicate checkout sessions for the same prospect meeting
- The checkout URL is sent to the prospect for payment

### OPERATES (agent runs real business operations)
- Researches prospects from their public profiles
- Generates personalized outreach scripts
- Renders personalized videos (3-5 min HeyGen rendering)
- Sends outreach emails via Resend with HTTPS share links
- Receives and classifies email replies (interested / not_now / question / unsubscribe)
- Books meetings and collects payment via live Stripe Checkout
- Reports cycle status via Telegram
- Runs on a cron schedule (9am weekdays) via Hermes

## Hermes skills

8 custom skills under `~/.hermes/skills/nuncio/`:

| Skill | Purpose |
|-------|---------|
| `sdr-orchestrator` | The autonomous loop blueprint (cron-scheduled 9am weekdays) |
| `nuncio-research` | Enqueue prospect via prospect-queue API |
| `nuncio-synthesize` | Profile synthesis |
| `nuncio-script` | Script generation / regeneration |
| `nuncio-render` | Video render + poll until video is ready |
| `nuncio-deliver` | Multi-channel delivery (email, LinkedIn, Twitter, WhatsApp) |
| `nuncio-handle-reply` | Poll reply-webhook, classify, respond |
| `sdr-earn` | Create Stripe checkout for booked meetings |

Plus 3 official Stripe Skills: `stripe-projects`, `stripe-link-cli`, `mpp-agent`.

## Stripe integration details

### Earning (Stripe Checkout)
- **Live mode**: `rk_live_...` key deployed to production
- **Customer reuse**: Looks up existing Stripe customers by email before creating a session. Repeat prospects get a unified payment history.
- **Idempotency**: Uses `idempotencyKey: earn-checkout-{shareId}-{meetingType}` so duplicate agent calls return the same session, not a duplicate charge.
- **Dynamic products**: Uses inline `price_data` with `product_data` for each meeting type (consultation, demo, discovery, strategy) — no need to pre-create products in the Stripe Dashboard.
- **Webhook handling**: `checkout.session.completed` (grant credits + attach customer), `checkout.session.expired` (log for agent follow-up), `invoice.paid` (renewal credits), `invoice.payment_failed` (downgrade to free), `customer.subscription.deleted` (cleanup).
- **Webhook endpoint**: `https://nuncio.persidian.com/api/webhook` — registered in live mode with signature verification.

### Spending (Stripe Projects)
- Agent runs `stripe projects add elevenlabs/tts` to provision TTS credits
- Agent runs `stripe projects add exa/api` to provision web search API credits
- Credentials sync automatically to `~/.hermes/.env`

## Verified end-to-end results

| Step | Component | Result |
|------|-----------|--------|
| Hermes + Nemotron | Model | `nvidia/nemotron-3-ultra-550b-a55b` via build.nvidia.com |
| Stripe Projects (spend) | `stripe projects add elevenlabs/tts` | Provisioned ElevenLabs TTS credits autonomously |
| Stripe Projects (spend) | `stripe projects add exa/api` | Provisioned Exa web search API autonomously |
| Hermes SDR loop | Full autonomous cycle | 6-step loop: research -> render -> email -> reply classification -> Stripe earn -> Telegram report |
| Telegram gateway | @nuncioappbot | Report messages sent with prospect info and share links |
| Resend email | Real outreach email | Sent to prospect with HTTPS video share link |
| Video rendering | HeyGen | Personalized video rendered (3-5 min), share page shows video with play button |
| Stripe earn (live) | `POST /api/agent/earn-checkout` | Live Stripe Checkout session created (`cs_live_...`) for $50 consultation |
| Stripe webhook | `https://nuncio.persidian.com/api/webhook` | Live endpoint registered, signature verification active |
| Production deploy | https://nuncio.persidian.com | All agent endpoints live with Turso persistence + Let's Encrypt SSL |

## How to run

```bash
# 1. The nuncio server is already running at https://nuncio.persidian.com
#    All agent endpoints are live.

# 2. Run the autonomous SDR agent via Hermes + Nemotron 3 Ultra
hermes -m nemotron -z "Run the sdr-orchestrator skill. Find a prospect at https://www.eladgil.com, research them, generate a personalized video, wait for the video to render, send the outreach email, send a Telegram report, classify a reply, and create a Stripe checkout for $50." --toolsets "terminal" --yolo

# 3. For cron-scheduled autonomous mode (9am weekdays)
# Configure via: hermes cron
```

## What makes this a business tool

- **Real revenue**: The agent creates live Stripe Checkout sessions for booked meetings. $50 per consultation. Real money, not test mode.
- **Real spending**: The agent provisions its own services via Stripe Projects (ElevenLabs, Exa). It pays for its own tools.
- **Real operations**: The agent runs the full SDR loop — research, script, video, email, reply classification, booking — without human intervention.
- **Real reporting**: The agent sends cycle reports via Telegram, so the operator can monitor performance.
- **Production-grade**: HTTPS, Turso persistence, live Stripe, idempotent checkout, customer reuse, webhook signature verification.
- **Hybrid mode**: The agent can queue drafts for human review in the studio — best of autonomous scale + human quality control.

## Repo

- GitHub: https://github.com/udirobert/nuncio
- Production: https://nuncio.persidian.com
- Telegram bot: @nuncioappbot
