# nuncio — Agent Context

## Goal
Build a creative monopoly in **conversational SDR** — honest presence, not disguised volume.

**Thesis:** in the age of infinite AI content, the scarce resource in sales is credible presence. nuncio makes the actual sender honestly present at every first touch — a live AI twin trained on their face, voice, and playbook — where the artifact doesn't advertise the conversation, it *is* the conversation. Recorded video is the fallback artifact inside the live link; the `SenderPlaybook` is the compounding moat; the schlep (latency, guardrails, booking, compliance) is the barrier to entry.

**Full thesis, first market, phased plan, falsification criteria, and scoreboard: `docs/STRATEGY.md` — the single source of truth for strategy. Do not restate strategy in other docs.**

Current phase: STRATEGY Phase 1 — live-link-first defaults + live-session instrumentation. `SenderPlaybook`, `deliveryMode`, and the LiveLink POC are built; the dual-mode architecture (Band studio + Hermes autonomous) is in place.

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
- Recent activity fires **before** synthesis (reordered) so the LLM sees the full picture (identity + recent posts) before committing to a characterization; company enrichment still fires after synthesis (needs `profile.company`)
- Script variants use **single LLM call** (not two) to save cost and time
- Cinematic entrance generated **non-blocking** (try/catch) like soundscape — build succeeds even if ElevenLabs fails
- `WorkspaceAccount.lastSenderBrief` persisted server-side rather than localStorage for cross-device continuity
- Sentry configured as **opt-in** — no-op until `SENTRY_DSN` env var is set
- Speech Engine voice agent uses `engine.attach()` on the same HTTP server as Next.js; conversation token generated via `POST /v1/convai/conversation/token`; browser connects via `@elevenlabs/client` `Conversation.startSession({ conversationToken })`
- Voice overlay ("Brief with voice") is an alternative input channel in the studio; LLM extracts structured profile from natural conversation. Per STRATEGY Phase 2, it is also the intended capture instrument for hand-built `SenderPlaybook` interviews.
- Nomenclature currently uses "AI-powered · personalised video" for badge, "Build video" for CTA, "Background audio" for soundscape selector — **superseded pending STRATEGY Phase 3 positioning rewrite** (honest-twin framing)
- Email gate captured on explicit render/share/download actions, not session start; **once-per-session** — `capturedEmail` reused for all subsequent actions, modal only re-opens when genuinely absent
- **Three-tier storage** (Backblaze hackathon): B2 = media asset store (videos, audio, thumbnails, traces, per-share asset manifests, S3 user-defined metadata), Grove = immutable provenance anchor (proof v2 with content hashes + Genblaze manifest URIs), Genblaze worker = orchestration SDK. No overlap between tiers.
- **Genblaze worker owned by nuncio** at `workers/genblaze/` (Python/FastAPI), not by Hermes. Multi-step `Pipeline("nuncio-composite")` chains thumbnail (GMI Cloud) + soundscape + TTS (ElevenLabs) in one run. HeyGen video stays outside Genblaze (no adapter); rendered video persisted to B2 via `MediaStorageProvider`.
- **Hermes demoted** to an optional cron trigger over `/api/agent/*`; all generation logic lives in nuncio's repo.
- Genblaze/B2 usage is **opt-in and non-blocking**: `GENBLAZE_WORKER_URL` and `B2_*` env vars gate the paths; absence falls back to direct provider calls / raw URLs.
- **Dual-mode architecture**: Band agents (human-driven studio) and Hermes agent (autonomous background) are two clients over the same API layer. No duplication — both consume shared pipeline step functions. Band agents are NOT replaced or deprecated.
- **Pipeline steps extracted** to `src/lib/pipeline/steps.ts` — single source of truth for research → synthesize → script → review → render → generate media assets. Both the existing pipeline route and agent endpoints call these shared functions. The `generateMediaAssets()` step (Step 6) calls the Genblaze composite pipeline for thumbnail + soundscape + narration generation, persists all assets to B2, and writes a per-share asset manifest and pipeline trace.
- **Agent API layer** lives under `src/app/api/agent/` — clean domain boundary. Auth via `NUNCIO_AGENT_TOKEN` env var (single shared token, not per-user).
- **Hermes uses Nemotron 3 Ultra** (`nvidia/nemotron-3-ultra-550b-a55b` via build.nvidia.com) for reasoning/orchestration; nuncio's existing LLM fallback chain handles content generation. Clean separation — no model config duplication.
- **Stripe Skills installed in Hermes**, not built in nuncio. `stripe-projects` provisions HeyGen/ElevenLabs credits autonomously; `stripe-link-cli` handles earning (checkout for booked meetings). Nuncio's `/api/agent/earn-checkout` is a thin server-side proxy for Stripe Checkout creation.
- **Hybrid mode**: Hermes can queue draft videos for human review in the studio — best of autonomous scale + human quality control. Per STRATEGY Phase 4, hybrid is the default when Hermes becomes the scale layer; fully-autonomous is a config toggle.
- **Proxy-aware URL resolution**: `src/lib/url.ts` (`resolvePublicOrigin`, `absoluteUrl`) resolves the public origin from `APP_URL` env var → `X-Forwarded-Host`/`X-Forwarded-Proto` headers → request host → localhost fallback. All auth redirects, magic-link emails, and Stripe checkout URLs use this — prevents the `localhost:3000` redirect bug behind reverse proxies (Coolify/Caddy/Traefik).
- **Credit guard consistency**: every credit-gated route (pipeline, video, live session, etc.) respects `creditsEnforced()`. In production, `NUNCIO_CREDITS_ENFORCED=true` — credits are enforced and a 402 is returned when exhausted. Each visitor gets 15 trial credits (~1-2 pipeline runs); after that, Stripe Checkout prompts purchase of credit packs. In shadow mode (`NUNCIO_CREDITS_ENFORCED` unset, e.g. local dev), no route hard-blocks with a 402. Local `.env.local` is aligned with production (`NUNCIO_CREDITS_ENFORCED=true`).
- **Research quality gate**: `assessResearchQuality()` in `src/lib/pipeline/steps.ts` evaluates source count, recent post count, search-fallback usage, and TinyFish API warnings to assign a confidence level (`high` / `medium` / `low`). Low-confidence profiles block auto-render (no wasted HeyGen credit) and surface an amber warning banner in the studio. The pipeline emits a `research_quality` SSE phase event immediately after synthesis so the client can warn before the script is generated. In agent mode, low-confidence profiles get `needsReview: true` for hybrid-mode human review.
- **TinyFish failure is loud, not silent**: `TinyFishApiError` (`src/lib/tinyfish.ts`) is thrown on 401/403 (auth/quota), 429 (rate limit), and 5xx (unavailable) — instead of silently returning empty arrays. Warnings propagate through `EnrichmentResult.warning` and `RecentActivityResult.warning` to the pipeline, which surfaces them to the user.
- **Twitter/X de-biasing**: identity-first search (`-site:x.com` for LinkedIn/GitHub/personal sites) runs *before* tweet searches; tweet results are capped at 5; the synthesis prompt explicitly instructs the LLM to weight stable sources over ephemeral tweets and to mark confidence as `low` when data is thin.
- **Resumable render polling**: render job `videoId` is persisted to `sessionStorage` on start. A `useEffect` on studio mount checks for a pending render and polls it in the background (every 10s). This lets users tab away during the 2–5 min HeyGen render and come back without losing progress.
- **Livelink ready state**: the studio ready screen adapts to `deliveryMode`. In livelink mode it shows "Live link ready" and hides the render button, audio memo button, and re-render section. In video mode it shows the full render/share/download flow.
- **Error surfacing**: `handleRegenerate`, `handleTtsPreview`, and `handleAudioMemo` surface user-facing toast messages (auto-dismissed after 6s) via a `toastMessage` state on the studio client — no silently swallowed errors.
- **Share page trust**: `/v/[id]` shows sender name + role + company below the greeting. Primary CTA is a "Reply" button (mailto with pre-filled subject + body). Polls for video completion (every 10s) if not rendered yet. Per STRATEGY Phase 3, this page becomes the recipient→sender viral surface.
- **Live page resilience**: `/live/[id]` checks `navigator.permissions` + `getUserMedia` for microphone access before starting the session. On repeated failures (2+ retries), a fallback link to the recorded video (`/v/[id]`) is shown. Error type is classified (`connection` vs `mic` vs `provider`) for targeted messaging.
- **Dashboard share links**: `RecentVideos` links to `/v/{id}` (branded share page) instead of the raw `videoUrl`, with a "Copy link" button alongside "View".
- **URL validation on input**: studio URL input validates on blur via `validateUrl()` — checks for valid URL format and warns (soft) if the host isn't a recognized social profile. Hard error only for malformed URLs.

## Recent Commits
Not maintained — use `git log --oneline`. Milestone order: Band studio pipeline → speech engine / voice overlay → LiveLink POC (Anam, `deliveryMode`) → Backblaze hackathon (B2 / Genblaze / Grove) → Phase 9 Hermes agent layer (verified end-to-end 2026-06-30).

## Next Steps
Strategic plan (phases, gates, scoreboard) lives in `docs/STRATEGY.md`. Engineering backlog:

- **Live-link-first defaults** (STRATEGY Phase 1) — make the live link the primary artifact; recorded video becomes the fallback inside it
- **Live-session instrumentation** (STRATEGY Phase 1) — started, turns, question topics, booking event, drop-off point
- **Playbook capture** (STRATEGY Phase 2) — productize the 30-minute founder interview via voice overlay into `SenderPlaybook`
- **Share-page viral loop** (STRATEGY Phase 3) — turn "How this was made" into an explicit recipient→sender signup surface
- **Voice agent** — wire production server, test end-to-end, ElevenLabs Hack #10 submission video (closes May 28)
- **Script quality** — `fallbackScript()` produces raw data dumps when all LLM providers fail; improve to clean hooks + meaningfully different variants
- **Band agent progress events** — server-side progress events from the pipeline route as fallback for WebSocket gaps
- **Credit spend transparency** — show credits spent this session on the ready screen
- **Share page trust signals** — sender photo, company logo, or verified-sender badge (feeds STRATEGY S2 honest-disclosure framing)

## Phase 9: Autonomous SDR Agent (DONE — summary)

Hermes is an optional autonomous client over nuncio's agent API layer. All generation logic lives in this repo; Hermes supplies orchestration (Nemotron 3 Ultra) + skills + cron. Verified end-to-end 2026-06-30 (research → script → HeyGen render → email → reply classified "interested" → Stripe checkout → Telegram report), running inside the NemoClaw/OpenShell sandbox on a Brev GCP VM with declarative egress policies. Production: https://nuncio.persidian.com.

- **Agent API** (`src/app/api/agent/`, auth via `NUNCIO_AGENT_TOKEN`): `prospect-queue` (enqueue + poll), `reply-webhook` (receive + classify replies), `earn-checkout` (Stripe Checkout for booked meetings)
- **Hermes skills**: 8 SKILL.md files in `~/.hermes/skills/nuncio/` (orchestrator, research, synthesize, script, render, deliver, handle-reply, earn)
- **Reply flow**: prospect email → Resend inbound (`replies.persidian.com`, DKIM/SPF/MX verified) → `/api/webhook/resend` (Svix-verified) → fetch body → LLM classify (interested/not_now/unsubscribe/question) → `/api/agent/reply-webhook` → agent polls → Stripe checkout if interested
- **Stripe (live mode)**: keys + webhook secret via Coolify env vars; webhook at `/api/webhook` handles `checkout.session.completed/expired`, `invoice.paid/payment_failed`, subscription lifecycle; earn-checkout does customer reuse by email, idempotency keys, dynamic product creation
- **Ops**: Hermes + nuncio share `NUNCIO_AGENT_TOKEN` and `NVIDIA_API_KEY` via `~/.hermes/.env`; Stripe Skills (`stripe-projects`, `stripe-link-cli`) let the agent provision HeyGen/ElevenLabs credits (spend) and create checkouts (earn); HeyGen render timeout is 10 min

### Operating Modes
| Mode | Driver | Band agents | Hermes | Use case |
|------|--------|-------------|--------|----------|
| Studio (existing) | Human | Yes | No | Craft perfect outreach with full control |
| Autonomous | Hermes | No | Yes | Run outreach unattended, report via chat |
| Hybrid (default per STRATEGY Phase 4) | Hermes + Human | No | Yes (drafts) | Agent generates drafts, human approves in studio |

## Relevant Files
- `docs/STRATEGY.md`: **Strategy single source of truth** — thesis, secrets, first market, phased plan, falsification criteria, scoreboard
- `docs/ROADMAP.md`: Engineering roadmap — LiveLink gates/implementation, artifact quality, validation; references STRATEGY.md for positioning
- `src/lib/voice-agent/prompt.ts`: LLM prompt for conversation-to-structed-profile extraction
- `src/lib/voice-agent/types.ts`: `VoiceExtractedProfile`, `ConversationTurn` types
- `src/server/production.ts`: Production server combining Next.js + Speech Engine WebSocket
- `src/voice-server/index.ts`: Standalone voice server (dev/separate deployment)
- `src/components/voice-overlay.tsx`: React voice conversation overlay using `@elevenlabs/client`
- `src/app/api/studio/voice/token/route.ts`: Generates conversation token via ElevenLabs ConvAI API
- `src/app/api/studio/voice/init/route.ts`: Returns WebSocket URL info
- `src/lib/claude.ts`: `generateScriptVariants()`, `ScriptVariants` type
- `src/lib/tinyfish.ts`: `fetchRecentActivity()`, `enrichCompany()`, `TinyFishApiError` (loud API failure instead of silent empty results)
- `src/lib/elevenlabs.ts`: `generateCinematicEntrance()`, `textToSpeech()`, `generateSoundEffect()`, `VIBE_PRESETS`
- `src/app/studio/studio-client.tsx`: Studio UI with progressive disclosure input (URL validation, sample briefs, voice brief), review stage (script editing, TTS preview, research quality warnings), building/ready/error states (resumable render polling via `sessionStorage`, toast for non-blocking errors), email gate (once-per-session), livelink-ready state separation
- `src/app/v/[id]/page.tsx`: Prospect-facing share page — sender context bar (name + role + company), Reply CTA (mailto), "Say thanks" (clipboard), share link polling, "How this was made" trace
- `src/app/live/[id]/page.tsx`: Live avatar landing page — mic permission check before session start, error classification (connection/mic/provider), retry fallback to recorded video, Anam SDK session lifecycle
- `src/app/dashboard/components/recent-videos.tsx`: Dashboard recent activity — links to `/v/{id}` share page (not raw video URL), "Copy link" button per video
- `next.config.ts`, `sentry.*.config.ts`, `instrumentation.ts`, `global-error.tsx`: Sentry setup
- `src/lib/pipeline/steps.ts`: Shared pipeline step functions (research, synthesize, script, render, deliver) — single source of truth for both pipeline route and agent endpoints. Includes `assessResearchQuality()` and `ResearchQuality` type for confidence-gated rendering.
- `src/lib/agent-auth.ts`: Agent API token validation (`NUNCIO_AGENT_TOKEN`)
- `src/app/api/agent/prospect-queue/route.ts`: Enqueue + poll prospect processing for autonomous agent
- `src/app/api/agent/reply-webhook/route.ts`: Receive + classify email replies
- `src/app/api/agent/earn-checkout/route.ts`: Create Stripe Checkout for booked meetings
- `src/app/api/webhook/resend/route.ts`: Resend inbound email webhook (Svix signature verification, body fetch, LLM classification, forward to reply-webhook)
- `src/lib/pipeline/video-poller.ts`: Server-side HeyGen video polling (10 min timeout, 5s interval)
- `src/lib/storage/b2-provider.ts`: Backblaze B2 media storage provider (S3-compatible, user-defined metadata, `listKeys`)
- `src/lib/storage/media-store.ts`: Media persistence layer (`persistVideo`, `persistAudio`, `persistTrace`, `persistAssetManifest`); non-blocking, SHA-256 hashing
- `src/lib/genblaze-client.ts`: TypeScript client for the Genblaze worker (`genblazeTts`, `genblazeSoundscape`, `genblazeThumbnail`, `genblazeComposite`)
- `src/app/api/persist/route.ts` + `src/app/api/persist/trace/route.ts`: B2 video persist + trace/asset-manifest persist endpoints
- `src/app/api/thumbnail/route.ts`: Custom thumbnail generation via Genblaze worker (GMI Cloud)
- `workers/genblaze/`: Genblaze orchestration worker (FastAPI). `main.py` (endpoints), `providers.py` (multi-step pipelines), `Dockerfile`, `README.md`
- `docs/DEVPOST-BACKBLAZE.md`: Backblaze Generative AI Media Hackathon submission writeup
- `docs/HACKATHON-REPO-ACCESS.md`: Checklist for granting `b2genblaze` judge access to the private repo
- `src/lib/url.ts`: Proxy-aware public URL resolution (`resolvePublicOrigin`, `absoluteUrl`) — prevents localhost redirects behind reverse proxies
- `agents/nuncio_agents/`: Band agents (researcher, copywriter) — human-driven studio mode, NOT deprecated
- `~/.hermes/skills/nuncio/`: Hermes skills for autonomous SDR mode (8 SKILL.md files)

<!-- stripe-projects-cli managed:agents-md:start -->
## Stripe Projects CLI

This repository is initialized for the Stripe project "nuncio".

## Tools used

- [Stripe CLI](https://docs.stripe.com/stripe-cli) with the `projects` plugin to manage third-party services, credentials, and deployments for this project. Use the stripe-projects-cli to manage deploying and access to third party services.
<!-- stripe-projects-cli managed:agents-md:end -->
