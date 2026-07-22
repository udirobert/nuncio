# nuncio — Agent Context

## Goal
Build a creative monopoly in **conversational SDR**. nuncio moves from "personalised video outreach" to a live, agentic AI avatar of the sender — trained on their face, voice, and playbook — that can hold real-time conversations with prospects, answer questions within bounded guardrails, and book meetings.

Recorded video is the wedge. Live conversation is the product. The schlep (latency, guardrails, booking, compliance) is the moat.

Current phase: extend the existing dual-mode architecture (Band studio + Hermes autonomous) with a `SenderPlaybook` and a `deliveryMode` so the same research → synthesize → script pipeline can power both recorded video and live-link conversations.

## Core Principles
- **ENHANCEMENT FIRST**: Always prioritize enhancing existing components over creating new ones
- **CONSOLIDATION**: Delete unnecessary code rather than deprecating
- **PREVENT BLOAT**: Systematically audit and consolidate before adding new features
- **DRY**: Single source of truth for all shared logic
- **CLEAN**: Clear separation of concerns with explicit dependencies
- **MODULAR**: Composable, testable, independent modules
- **PERFORMANT**: Adaptive loading, caching, and resource optimization
- **ORGANIZED**: Predictable file structure with domain-driven design

## Constraints & Preferences
- Next.js App Router with Turso (SQLite) or file-based storage providers; provider selected by `TURSO_DATABASE_URL` or `NUNCIO_DATA_DIR`
- Resend for transactional email; `RESEND_API_KEY` controls send vs. console-log fallback
- ElevenLabs for TTS (`textToSpeech`), sound effects (`generateSoundEffect` at `/v1/sound-generation`), and Speech Engine voice agent (`engine.attach()` on shared HTTP server)
- Speech Engine: `SPEECH_ENGINE_ID` env var activates the voice agent; `VOICE_PUBLIC_URL` sets the wsUrl; both packages: `@elevenlabs/elevenlabs-js` (server) and `@elevenlabs/client` (browser `Conversation.startSession`)
- `fetchRecentActivity()` uses TinyFish Search API for Twitter/X and LinkedIn recent posts
- Production server at `src/server/production.ts` — runs Next.js + Speech Engine WebSocket on the same HTTP server; started via `tsx src/server/production.ts` (the `start` script)
- Ensure correct `gh` auth profile before push; deploy via SSH to the production server (see `scripts/deploy-nuncio.sh`)
- Sentry DSN set on Coolify via env vars; `SENTRY_DSN` activates `@sentry/nextjs` v10
- `WorkspaceAccount` extended with `lastSenderBrief` and `lastSenderName`
- Cinematic entrance generated in build pipeline as `data:audio/mpeg;base64` URL alongside soundscape; played on user click in `/v/[id]` before video starts
- Email templates use inline-string base template with full `<html>` wrapper, `<style>` block, and mobile-first media queries

## Key Decisions
- Recent activity + company enrichment fire **after** synthesis (not before), keeping enrichment lightweight
- Script variants use **single LLM call** (not two) to save cost and time
- A/B variants default to **off in quick mode** — only advanced mode shows the picker
- Cinematic entrance generated **non-blocking** (try/catch) like soundscape — build succeeds even if ElevenLabs fails
- `WorkspaceAccount.lastSenderBrief` persisted server-side rather than localStorage for cross-device continuity
- Sentry configured as **opt-in** — no-op until `SENTRY_DSN` env var is set
- Speech Engine voice agent uses `engine.attach()` on the same HTTP server as Next.js; conversation token generated via `POST /v1/convai/conversation/token`; browser connects via `@elevenlabs/client` `Conversation.startSession({ conversationToken })`
- Voice overlay ("Brief with voice") is an alternative input channel in the studio; LLM extracts structured profile from natural conversation
- Nomenclature uses "AI-powered · personalised video" for badge, "Build video" for CTA, "Background audio" for soundscape selector
- Email gate captured on explicit render/share/download actions, not session start
- **Dual-mode architecture**: Band agents (human-driven studio) and Hermes agent (autonomous background) are two clients over the same API layer. No duplication — both consume shared pipeline step functions. Band agents are NOT replaced or deprecated.
- **Pipeline steps extracted** to `src/lib/pipeline/steps.ts` — single source of truth for research → synthesize → script → render → deliver. Both the existing pipeline route and agent endpoints call these shared functions.
- **Agent API layer** lives under `src/app/api/agent/` — clean domain boundary. Auth via `NUNCIO_AGENT_TOKEN` env var (single shared token, not per-user).
- **Hermes uses Nemotron 3 Ultra** (`nvidia/nemotron-3-ultra-550b-a55b` via build.nvidia.com) for reasoning/orchestration; nuncio's existing LLM fallback chain handles content generation. Clean separation — no model config duplication.
- **Stripe Skills installed in Hermes**, not built in nuncio. `stripe-projects` provisions HeyGen/ElevenLabs credits autonomously; `stripe-link-cli` handles earning (checkout for booked meetings). Nuncio's `/api/agent/earn-checkout` is a thin server-side proxy for Stripe Checkout creation.
- **Hybrid mode**: Hermes can queue draft videos for human review in the studio — best of autonomous scale + human quality control. This is the primary product mode; fully-autonomous is a config toggle.

## Recent Commits
- `dd25738` — HeyGen captions via v3 API + mode switch UX toast
- `ecd1c43` — captions toggle + circular flow on advanced ready screen
- `4b430b0` — TokenRouter (MiniMax-M3) free LLM fallback provider
- `b45e3bc` — LLM provider fallback chain + dead-end UX improvements
- `564e049` — close dead-ends: dashboard CTA, share page reply, error state, post-login redirect
- `24b066f` — dashboard shows past videos + circular flow on ready screen
- `e8509b7` — overhaul build-wait screen + fix credit tests
- `56d8d84` — fallback to email upsert when workspace not found in Turso
- `22a1390` — credits use Turso as single source of truth
- `517d283` — studio simplification (Phase 7)
- `8ddd233` — multi-language delivery
- `35bd035` — cinematic entrance integration + responsive email templates
- `009f120` — phase 8: nomenclature, batch link from studio, footer, studio polish
- `ccaae6e` — speech engine integration: voice agent, overlay UI, conversation token endpoint, LLM prompt, standalone voice server
- (pending) — LiveLink POC: deliveryMode on ShareRecord, /api/share livelink path, studio client creates live link, QuickReady shows live link card

## Next Steps
- Voice agent: wire production server, test end-to-end, create submission video for ElevenLabs Hack #10 (closes May 28)
- Multi-language delivery — auto-detect target language, offer translation in studio UI
- Multi-channel distribution — link batch from studio ready page (done)
- **Studio mode unification** — merge Quick and Advanced modes into a single progressive-disclosure component. Currently two separate UIs (`QuickInput` vs inline advanced form) with a `quickMode` toggle. Switching feels abrupt and users fear losing work. Fix: one component with collapsible "More options" section. The Quick mode IS the advanced mode with extra fields hidden. Eliminates mode-switching anxiety entirely. Current toast notification ("your brief is preserved") is a band-aid.
- **Script quality** — profile synthesis and script generation rely on LLM fallback chain (Featherless → Venice → TokenRouter). The `fallbackScript()` heuristic produces raw data dumps when all LLM providers fail. Improve fallback to clean hooks and generate meaningfully different variants.
- **Band agent progress events** — researcher agent posts intermediate progress events to activity bridge during enrichment, but WebSocket instability may cause gaps. Consider adding server-side progress events from the pipeline route as a fallback.
- **Credit spend transparency** — show credits spent during the current session on the ready screen (currently only shows remaining balance).

## Phase 9: Autonomous SDR Agent (Hermes Hackathon + Product)

### Architecture: Dual-Mode, Single Pipeline
```
  Band agents (existing)          Hermes agent (new)
  Human-driven studio             Autonomous background
         │                              │
         ▼                              ▼
  ┌──────────────────────────────────────────┐
  │  Shared API Layer (src/lib/pipeline/)    │
  │  research → synthesize → script →        │
  │  render → deliver                        │
  └──────────────────────────────────────────┘
```

### Implementation Plan

**Phase 0 — DRY Refactor (DONE)**
- Extracted pipeline step functions from `src/app/api/pipeline/route.ts` into `src/lib/pipeline/steps.ts`
- Route is now a thin SSE handler calling shared steps (`researchAndSynthesize`, `generateOutreachScript`, `reviewScript`, `renderVideo`)
- Band agents continue calling the route over HTTP — unchanged, zero behavior change
- Typecheck passes clean

**Phase 1 — Agent API Layer (DONE, verified end-to-end)**
- `src/lib/agent-auth.ts`: token validation (NUNCIO_AGENT_TOKEN env var), resolves to CreditSubject
- `POST/GET /api/agent/prospect-queue`: enqueue prospect for end-to-end processing, poll status
- `POST/GET /api/agent/reply-webhook`: receive + classify email replies via existing LLM fallback chain
- `POST /api/agent/earn-checkout`: create Stripe Checkout for booked meetings (reuses existing Stripe integration)
- All endpoints verified: auth rejection, successful pipeline execution, reply classification, Stripe checkout creation

**Phase 2 — Hermes Skills (DONE, all 8 enabled)**
- `sdr-orchestrator/SKILL.md`: the autonomous loop (blueprint, cron-scheduled 9am weekdays, Telegram delivery)
- `nuncio-research/SKILL.md`: enqueue prospect via prospect-queue API
- `nuncio-synthesize/SKILL.md`: profile synthesis
- `nuncio-script/SKILL.md`: script generation/regeneration
- `nuncio-render/SKILL.md`: video render + poll
- `nuncio-deliver/SKILL.md`: multi-channel delivery (email, LinkedIn, Twitter, WhatsApp)
- `nuncio-handle-reply/SKILL.md`: poll reply-webhook, classify, respond
- `sdr-earn/SKILL.md`: create Stripe checkout for booked meetings
- All skills visible in `hermes skills list` under `nuncio` category

**Phase 3 — NVIDIA + Stripe Wiring (DONE)**
- Hermes config: Nemotron 3 Ultra via build.nvidia.com (set as default model)
- NVIDIA_API_KEY set in both nuncio `.env` and Hermes `~/.hermes/.env`
- Stripe Skills installed: `stripe-projects`, `stripe-link-cli`, `mpp-agent` (from NousResearch/hermes-agent repo)
- NUNCIO_AGENT_TOKEN set in both nuncio `.env` and Hermes `~/.hermes/.env`
- Agent provisions own HeyGen/ElevenLabs credits when low (spends)
- Agent creates Stripe Checkout for booked meetings (earns)

**Phase 4 — Demo & Submission (DONE)**
- Full autonomous loop: prospect → research → video → deliver → reply → book → earn
- Hybrid mode: agent queues drafts for human review in studio
- Reports via Telegram: prospects contacted, replies, meetings, revenue, spend
- End-to-end test verified via Hermes + Nemotron: eladgil.com → profile synthesized → script generated → video rendered → email sent → Telegram report → reply classified "interested" → Stripe checkout created → final Telegram report
- **NemoClaw sandbox deployed on Brev GCP VM** — agent runs inside OpenShell with Landlock + seccomp + network policies
- **Resend inbound email verified** — `replies.persidian.com` domain verified (DKIM + SPF + MX), webhook → `/api/webhook/resend` → classify → reply-webhook
- **Video render timeout fixed** — increased from 5 min to 10 min (HeyGen can take 5-8 min)

**Verified End-to-End Results (2026-06-30)**
| Step | Component | Result |
|------|-----------|--------|
| NemoClaw sandbox | OpenShell isolation | Hermes v0.14.0 running inside sandbox (Landlock + seccomp + netns) on Brev GCP VM |
| Nemotron 3 Ultra | Routed inference | `nvidia/nemotron-3-ultra-550b-a55b` via OpenShell gateway → `inference.local` |
| Network policies | Declarative egress | `nuncio.persidian.com`, `api.resend.com`, `api.telegram.org`, `integrate.api.nvidia.com` — all verified from inside sandbox |
| Hermes SDR loop | Full autonomous cycle | Research → script → HeyGen render → Stripe earn → Telegram report — all from inside sandbox |
| Video rendering | HeyGen | Personalized video for Elad Gil rendered in ~8 min, share page live at `https://nuncio.persidian.com/v/b46b1f69-3f0` |
| Stripe earn (live) | `POST /api/agent/earn-checkout` | Live Stripe Checkout session `cs_live_a1qnZHAL...` created from inside sandbox for $50 consultation |
| Stripe webhook | `https://nuncio.persidian.com/api/webhook` | Live endpoint registered with signature verification |
| Resend inbound | `replies.persidian.com` | Domain verified (DKIM + SPF + MX), inbound email → `/api/webhook/resend` → classify → reply-webhook |
| Telegram channel | @nuncioappbot | Registered in sandbox, network policy active, tunnel started |
| Production deploy | https://nuncio.persidian.com | All agent endpoints live with Turso persistence + Let's Encrypt SSL |

**Stripe Integration (live mode)**
- `STRIPE_SECRET_KEY`: live restricted key (`rk_live_...`) deployed via Coolify env vars
- `STRIPE_PUBLISHABLE_KEY`: live publishable key (`pk_live_...`)
- `STRIPE_WEBHOOK_SECRET`: live webhook signing secret (`whsec_...`)
- Webhook endpoint registered in live mode at `https://nuncio.persidian.com/api/webhook`
- Events: `checkout.session.completed`, `checkout.session.expired`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`
- earn-checkout: customer reuse by email lookup, idempotency keys, dynamic product creation
- webhook: handles expired sessions (logs for agent follow-up), credit grants, subscription lifecycle

**Reply Webhook Wiring (DONE)**
The `/api/webhook/resend` endpoint receives inbound email replies from Resend, fetches the full body, classifies intent via LLM, and forwards to `/api/agent/reply-webhook` for agent processing.
1. `RESEND_API_KEY` set in `.env.local` — DONE
2. Resend inbound domain `replies.persidian.com` — verified (DKIM + SPF + MX all green)
3. Resend webhook endpoint → `https://nuncio.persidian.com/api/webhook/resend` — created with Svix signature verification
4. `RESEND_WEBHOOK_SECRET` set on production — DONE
5. `nuncio-deliver` skill updated with `replyTo: nuncio@replies.persidian.com` — prospects reply to inbound domain
6. Reply flow: email → Resend inbound → `/api/webhook/resend` (Svix verified) → fetch body → classify (interested/not_now/unsubscribe/question) → `/api/agent/reply-webhook` → agent polls → creates Stripe checkout if interested

### Operating Modes
| Mode | Driver | Band agents | Hermes | Use case |
|------|--------|-------------|--------|----------|
| Studio (existing) | Human | Yes | No | Craft perfect outreach with full control |
| Autonomous (new) | Hermes | No | Yes | Run outreach unattended, report via chat |
| Hybrid (new) | Hermes + Human | No | Yes (drafts) | Agent generates drafts, human approves in studio |

## Relevant Files
- `src/lib/voice-agent/prompt.ts`: LLM prompt for conversation-to-structed-profile extraction
- `src/lib/voice-agent/types.ts`: `VoiceExtractedProfile`, `ConversationTurn` types
- `src/server/production.ts`: Production server combining Next.js + Speech Engine WebSocket
- `src/voice-server/index.ts`: Standalone voice server (dev/separate deployment)
- `src/components/voice-overlay.tsx`: React voice conversation overlay using `@elevenlabs/client`
- `src/app/api/studio/voice/token/route.ts`: Generates conversation token via ElevenLabs ConvAI API
- `src/app/api/studio/voice/init/route.ts`: Returns WebSocket URL info
- `src/lib/claude.ts`: `generateScriptVariants()`, `ScriptVariants` type
- `src/lib/tinyfish.ts`: `fetchRecentActivity()`, `enrichCompany()`
- `src/lib/elevenlabs.ts`: `generateCinematicEntrance()`, `textToSpeech()`, `generateSoundEffect()`, `VIBE_PRESETS`
- `src/app/studio/studio-client.tsx`: Studio UI with "Brief with voice" button, progressive disclosure, etc.
- `next.config.ts`, `sentry.*.config.ts`, `instrumentation.ts`, `global-error.tsx`: Sentry setup
- `src/lib/pipeline/steps.ts`: Shared pipeline step functions (research, synthesize, script, render, deliver) — single source of truth for both pipeline route and agent endpoints
- `src/lib/agent-auth.ts`: Agent API token validation (`NUNCIO_AGENT_TOKEN`)
- `src/app/api/agent/prospect-queue/route.ts`: Enqueue + poll prospect processing for autonomous agent
- `src/app/api/agent/reply-webhook/route.ts`: Receive + classify email replies
- `src/app/api/agent/earn-checkout/route.ts`: Create Stripe Checkout for booked meetings
- `src/app/api/webhook/resend/route.ts`: Resend inbound email webhook (Svix signature verification, body fetch, LLM classification, forward to reply-webhook)
- `src/lib/pipeline/video-poller.ts`: Server-side HeyGen video polling (10 min timeout, 5s interval)
- `agents/nuncio_agents/`: Band agents (researcher, copywriter) — human-driven studio mode, NOT deprecated
- `~/.hermes/skills/nuncio/`: Hermes skills for autonomous SDR mode (8 SKILL.md files)

<!-- stripe-projects-cli managed:agents-md:start -->
## Stripe Projects CLI

This repository is initialized for the Stripe project "nuncio".

## Tools used

- [Stripe CLI](https://docs.stripe.com/stripe-cli) with the `projects` plugin to manage third-party services, credentials, and deployments for this project. Use the stripe-projects-cli to manage deploying and access to third party services.
<!-- stripe-projects-cli managed:agents-md:end -->
