# nuncio — Agent Context

## Goal
Build a creative monopoly in **conversational SDR** — honest presence, not disguised volume.

**Thesis:** in the age of infinite AI content, the scarce resource in sales is credible presence. nuncio makes the actual sender honestly present at every first touch — a live AI twin trained on their face, voice, and playbook — where the artifact doesn't advertise the conversation, it *is* the conversation. Recorded video is the fallback artifact inside the live link; the `SenderPlaybook` is the compounding moat; the schlep (latency, guardrails, booking, compliance) is the barrier to entry.

**Full thesis, first market, phased plan, falsification criteria, and scoreboard: `docs/STRATEGY.md` — the single source of truth for strategy. Do not restate strategy in other docs.**

Current phase: STRATEGY Phase 1 ✅ (defaults flipped, instrumentation live, predictions derived) → Phase 2 — ten founders hand-served; playbook capture via voice overlay. `SenderPlaybook`, `deliveryMode`, and the LiveLink POC are built; the dual-mode architecture (Band studio + Hermes autonomous) is in place.

**OpenClaw 2.0 first-hire hackathon — submitted and verified.** `nuncio` is live on the Agent Index (verified, 1-click deploy, finished listing) and reachable at +1 (650) 315-6335. Agent variant lives in `openclaw-agent/`; public backend is `POST /api/agent/lite`; pinned image `nuncio-openclaw:v4@sha256:eeb054b15b2a...` (self-hosted `ln_p2` on the dedicated OpenClaw host — see `docs/DEPLOY-NOTES.md` for host/build/push/rollback runbook). Working doc: `docs/OPENCLAW-HACKATHON.md`.

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
- Ensure correct `gh` auth profile before push; deploy via SSH to the production server using `scripts/deploy-vps.sh` (see `docs/DEPLOY.md`)
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
- **Honest-twin nomenclature shipped (Phase 3)**: "AI-powered · personalised video" is gone — studio badge reads "AI representative · disclosed to your recipient"; live page headline "A conversation with {sender}"; the live trust badge reads "AI representative · guided by their playbook" when the sender playbook is fully configured, otherwise "AI representative · general guidance" — never identity verification; landing/metadata/pricing aligned. Disclosure is a feature, never hidden
- **Live-link-first defaults (Phase 1)**: studio, `/api/share`, and `/api/pipeline` default to `livelink` when the pilot allows (`isLiveLinkAllowed`); explicit `"video"` is always respected; a supplied `videoUrl` implies video on share creation
- **Twin → human call bridge (2026-09)**: Synthesia Interactive Avatars over a customer-owned LiveKit project is the **primary** live provider (`NUNCIO_LIVE_PRIMARY_PROVIDER`, default `synthesia`); Anam is the startup fallback; HeyGen recorded video stays the artifact fallback. Durable `CallRequestRecord` (file + Turso) models recipient→owner call requests behind **explicit, expiring owner availability** (`callAvailabilityUntil`, never inferred from a calendar); scoped LiveKit tokens (`owner-<userId>` / `recipient-<requestId>`); "joined" means observed room presence, not acceptance; direct human calls reserve **no** avatar credits. Python worker `workers/live-avatar/` (agent `nuncio-synthesia`, `livekit-agents` ≥1.8.2 + `livekit-plugins-synthesia`) calls the internal `/api/live/agent/chat/completions` gateway (`NUNCIO_LIVE_WORKER_TOKEN` bearer + `x-nuncio-live-session` header; server-built prompt via `src/lib/live-prompt.ts`; client-supplied system messages ignored). `SYNTHESIA_API_KEY`/`ELEVEN_API_KEY` live only in the worker (the ElevenLabs plugin reads `ELEVEN_API_KEY`, not `ELEVENLABS_API_KEY`). Only `av_*` personal/synthetic Interactive Avatar IDs are eligible — the Synthesia gallery persona Kenji was verified working during evaluation; other stock actors' eligibility is unverified, not ruled out. LiveKit transport is metered; mobile is not optimized per Synthesia docs. **Hardening pass (untested — user owns verification):** every `CallRequestRecord` write is versioned CAS; accepts claim the record before creating a unique per-attempt room (`roomReady` gates join tokens, TTL ≤ 60s); cancel/decline/expiry/cron share one idempotent room-cleanup path (`roomClosedAt` only on confirmed absence, `cleanupError` flags ambiguity); presence is server-observed via `/presence` + signed `/api/live/call-requests/webhook` merged through frozen `src/lib/call-connection.ts`. Recipients may optionally draft and review a live-call brief (`POST /api/live/brief` → drafting in `src/lib/live-call-brief-server.ts`, parsing/limits in `src/lib/live-call-brief.ts`; consent-gated, rate-limited, nothing persisted until reviewed); only the four reviewed fields are stored on `CallRequestRecord.liveBrief` with `source: "recipient_reviewed"` — raw dialogue is never stored or returned by public APIs. Pending: LiveKit project + `av_*` avatar + worker deployment — locally implemented, **not live-verified**; startup was previously smoke-verified in production, but the current pass is undeployed and the full two-person path is still pending user-owned testing; Plow push notifications and phone bridging remain blocked (no known backend/interface).
- **Live-session instrumentation (Phase 1)**: `LiveSessionRecord.metrics` (`userTurns`, `agentTurns`, `questionTopics`, `bookingClicked`, `lastEvent` drop-off marker, `firstUserTurnAt`) heartbeated every 15s from `/live/[id]` and finalized on terminal `/api/live/sync` (heartbeat = POST without `reason`). Question topics are classified in-browser by `src/lib/live-topics.ts` into 9 buckets — **labels only**; the nuncio app does not persist or log raw dialogue (telemetry carries labels only — third-party provider/observability retention is separate; the optional consented brief draft sends a bounded recent dialogue to the configured AI service for one-shot summarization). Read path: `GET /api/live/sessions` (workspace-scoped)
- **Booking event**: `WorkspaceAccount.bookingUrl` (studio field, brief PATCH) snapshots onto `ShareRecord.bookingUrl`; "Book time with {sender}" CTA on `/live/[id]` and `/v/[id]`; twin's system prompt points warm prospects at it; `booking_clicked` PostHog event is the north-star proxy
- **Viral loop (S6)**: share-page CTA rewritten as recipient→sender signup ("This researched you… Make yours →") with `?ref=share-{id}` / `?ref=live-{id}` links; landing captures via `trackViralLanding`
- **Value metric**: credits remain the meter; pricing copy anchors on meetings booked / twin first touches — never "more sends"
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
- **Credit guard consistency**: every credit-gated route (pipeline, video, live session, Anam avatar/voice training, etc.) respects `creditsEnforced()`. `CreditAction` now includes `live.avatar` and `live.voice`; training costs default to 1 credit each and are configurable via `NUNCIO_ANAM_AVATAR_TRAINING_CREDIT_COST` and `NUNCIO_ANAM_VOICE_TRAINING_CREDIT_COST`. In production, `NUNCIO_CREDITS_ENFORCED=true` — credits are enforced and a 402 is returned when exhausted. Each visitor gets 15 trial credits (~1-2 pipeline runs); after that, Stripe Checkout prompts purchase of credit packs. In shadow mode (`NUNCIO_CREDITS_ENFORCED` unset, e.g. local dev), no route hard-blocks with a 402. Local `.env.local` is aligned with production (`NUNCIO_CREDITS_ENFORCED=true`).
- **Research quality gate**: `assessResearchQuality()` in `src/lib/pipeline/steps.ts` evaluates source count, recent post count, search-fallback usage, and TinyFish API warnings to assign a confidence level (`high` / `medium` / `low`). Low-confidence profiles block auto-render (no wasted HeyGen credit) and surface an amber warning banner in the studio. The pipeline emits a `research_quality` SSE phase event immediately after synthesis so the client can warn before the script is generated. In agent mode, low-confidence profiles get `needsReview: true` for hybrid-mode human review.
- **TinyFish failure is loud, not silent**: `TinyFishApiError` (`src/lib/tinyfish.ts`) is thrown on 401/403 (auth/quota), 429 (rate limit), and 5xx (unavailable) — instead of silently returning empty arrays. Warnings propagate through `EnrichmentResult.warning` and `RecentActivityResult.warning` to the pipeline, which surfaces them to the user.
- **Twitter/X de-biasing**: identity-first search (`-site:x.com` for LinkedIn/GitHub/personal sites) runs *before* tweet searches; tweet results are capped at 5; the synthesis prompt explicitly instructs the LLM to weight stable sources over ephemeral tweets and to mark confidence as `low` when data is thin.
- **Resumable render polling**: render job `videoId` is persisted to `sessionStorage` on start. A `useEffect` on studio mount checks for a pending render and polls it in the background (every 10s). This lets users tab away during the 2–5 min HeyGen render and come back without losing progress.
- **Livelink ready state**: the studio ready screen adapts to `deliveryMode`. In livelink mode it shows "Live link ready" and hides the render button, audio memo button, and re-render section. In video mode it shows the full render/share/download flow.
- **Error surfacing**: `handleRegenerate`, `handleTtsPreview`, and `handleAudioMemo` surface user-facing toast messages (auto-dismissed after 6s) via a `toastMessage` state on the studio client — no silently swallowed errors.
- **Share page trust**: `/v/[id]` shows sender name + role + company below the greeting. Primary CTA is a "Reply" button (mailto with pre-filled subject + body). Polls for video completion (every 10s) if not rendered yet. Per STRATEGY Phase 3, this page becomes the recipient→sender viral surface.
- **Live page resilience**: `/live/[id]` checks `navigator.permissions` + `getUserMedia` for microphone access before starting the session. On repeated failures (2+ retries), a fallback link to the recorded video (`/v/[id]`) is shown. Error type is classified (`connection` vs `mic` vs `provider`) for targeted messaging.
- **Dashboard share links**: `RecentVideos` links to `/v/{id}` (branded share page) instead of the raw `videoUrl`, with a "Copy link" button alongside "View". Live links open `/live/{id}`; `GET /api/videos/recent` returns a `firstTouches` projection — invitation-protected shares render "Owner view" only (never a copyable link missing its handoff fragment).
- **Frontend IA**: dashboard is split by query — `/dashboard` = conversations inbox, `/dashboard?view=setup` = `SetupPanel` (identity/playbook/scheduling/provider fields; status is configuration presence, not health). Public `/playbook` shows "First-touch examples" and is read-only. The homepage hero uses `RelationshipJourney` (`#prospect-experience`), a labeled illustrative component — no live session.
- **URL validation on input**: studio URL input validates on blur via `validateUrl()` — checks for valid URL format and warns (soft) if the host isn't a recognized social profile. Hard error only for malformed URLs.
- **Text→live handoff**: `POST /api/agent/handoffs` mints owner-authorized private invitations. `NUNCIO_AGENT_TOKEN` must be paired with explicit `NUNCIO_AGENT_WORKSPACE_ID` (routes 503 without it — one token binds one workspace, not a global multitenant credential). `ShareRecord` carries only a `handoffId` marker; the private `HandoffRecord` (file + Turso providers) holds the SHA-256 token hash and bounded context (summary ≤2000, ≤8 interests, ≤8 unanswered questions — never transcripts or contact data). Invite token travels in `#handoff=` fragment → exchanged into a host-only HttpOnly `nuncio_handoff_<shareId>` cookie holding the raw bearer token (`src/lib/live-handoff-client.ts` strips the hash before the handoff fetch/telemetry); forwardable bearer link, not identity verification, not single-use. `authorizeHandoffShare` gates share GET / live session / availability / call-request create; an owner session may bypass only while the invite is active — expired/revoked denies everyone. Revoke (DELETE) blocks future entry but never force-ends connected calls. Owner-agent polling inbox: `GET /api/agent/call-requests` — pull only, no push, no phone channel. Implementation is local and unverified — see `docs/TESTING.md` handoff checklist.

## Recent Commits
Not maintained — use `git log --oneline`. Milestone order: Band studio pipeline → speech engine / voice overlay → LiveLink POC (Anam, `deliveryMode`) → Backblaze hackathon (B2 / Genblaze / Grove) → Phase 9 Hermes agent layer (verified end-to-end 2026-06-30).

## Next Steps
Strategic plan (phases, gates, scoreboard) lives in `docs/STRATEGY.md`. Engineering backlog:

- ~~**Playbook capture** (STRATEGY Phase 2)~~ ✅ — `VoiceOverlay` now supports `campaign` and `playbook` modes and extracts/persists `SenderPlaybook` + sender identity fields via `/api/account/brief`
- ~~**Scoreboard dashboard**~~ ✅ — `ScoreboardCard` on `/dashboard` surfaces live-session aggregates from `GET /api/live/sessions`
- **Reply-to-live escalation** — email replies can open a live avatar session instead of static follow-up
- **Share-page trust signals** — sender photo, company logo, or verified-sender badge on `/v/[id]` and `/live/[id]`
- **Pre-send review** — research, hook, script, and visual plan reviewable before credits are spent
- **Visual proof brief** — collect 1–3 sender assets (screenshot, logo, proof point, case study, deck slide) for a proof-first composition
- **LiveLink pilot guardrails** — credit reservations for training and sessions (including anonymous shares), provider-neutral error surfacing, workspace/sender allowlist, capped/idle worker sessions, lifecycle cleanup, and recorded-video fallback are implemented locally. Remaining before launch: live Synthesia/LiveKit verification, worker deployment, webhook/scheduler setup, owner push notifications, scheduling, and phone bridging.
- **Voice agent** — wire production server, test end-to-end, ElevenLabs Hack #10 submission video (closes May 28)
- **Script quality** — `fallbackScript()` produces raw data dumps when all LLM providers fail; improve to clean hooks + meaningfully different variants
- **Band agent progress events** — server-side progress events from the pipeline route as fallback for WebSocket gaps
- **Credit spend transparency** — show credits spent this session on the ready screen

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
- `src/lib/live-topics.ts`: Question-topic classifier (9 buckets, pure function, browser+server) — labels only; the nuncio app does not persist raw dialogue (the opt-in recipient-reviewed brief sends bounded dialogue to the configured AI service on explicit click only)
- `src/lib/live-session.ts`: `recordLiveSessionTelemetry()` (heartbeat, pending→active, metric merge) + `reconcileLiveSession()` (terminal, metrics-aware)
- `src/app/api/live/sync/route.ts`: Heartbeat (no `reason`) + terminal sync with sanitized metrics
- `src/app/api/live/sessions/route.ts`: Workspace-scoped scoreboard read path for recent terminal sessions
- `src/lib/url.ts`: Proxy-aware public URL resolution (`resolvePublicOrigin`, `absoluteUrl`) — prevents localhost redirects behind reverse proxies
- `agents/nuncio_agents/`: Band agents (researcher, copywriter) — human-driven studio mode, NOT deprecated
- `~/.hermes/skills/nuncio/`: Hermes skills for autonomous SDR mode (8 SKILL.md files)

## UI/UX implementation conventions

- Use the project's explicit type scale utilities:
  - `text-label-xs` (was `text-[9px]`), `text-label-sm` (was `text-[10px]`), `text-label-base` (was `text-[11px]`)
  - `text-body-xs` (was `text-xs`), `text-body-sm` (was `text-sm`)
- Prefer explicit `transition-[color,background-color,border-color,opacity,box-shadow,transform]` lists instead of `transition-all`.
- Do not put `transition` on `*:focus-visible`; focus rings must appear instantly for keyboard users.
- The shared `Header` is fixed with `bg-cream/80 backdrop-blur-md border-b border-cream-dark/60 pointer-events-auto`.
- Interactive rows that contain nested buttons (e.g. Batch campaign cards) should use a `div` with `role="button"` rather than a native `<button>` to avoid invalid HTML nesting.
- Share-page action buttons are split into primary (`Reply`, `Book time`) and secondary (`Say thanks`, `Send one back`) rows with `flex-wrap` so they adapt to mobile.
- Load project-specific UI skills before working on marketing or studio pages:
  - `.devin/skills/nuncio-landing-section/SKILL.md`
  - `.devin/skills/nuncio-studio-form/SKILL.md`

<!-- stripe-projects-cli managed:agents-md:start -->
## Stripe Projects CLI

This repository is initialized for the Stripe project "nuncio".

## Tools used

- [Stripe CLI](https://docs.stripe.com/stripe-cli) with the `projects` plugin to manage third-party services, credentials, and deployments for this project. Use the stripe-projects-cli to manage deploying and access to third party services.
<!-- stripe-projects-cli managed:agents-md:end -->
