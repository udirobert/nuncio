# Roadmap

## Status

nuncio is in production. The core pipeline — enrichment → script → canvas → video — is live at
[nuncio.persidian.com](https://nuncio.persidian.com) with credit enforcement, Stripe payments,
magic-link auth, and batch campaign support. All provider integrations (TinyFish, Featherless,
HeyGen, Melius, ElevenLabs, Speechmatics) are active.

---

## Phase 0 — Hackathon MVP (May 14–15)

**Goal:** Working end-to-end pipeline that can demo live on stage.

- [x] TinyFish enrichment for LinkedIn + Twitter/X, plus GitHub/Farcaster/Facebook/personal URL validation
- [x] Claude/LLM two-pass synthesis (profile JSON + script) with Featherless fallback
- [x] HeyGen video creation via Video Agent with `/v3/videos` fallback
- [x] Avatar V integration
- [x] Voice clone setup (pre-cloned, stored as env var)
- [x] Melius canvas creation + asset storage via MCP, with optional Fal image generation fallback
- [x] Polling endpoint for video status
- [x] Minimal frontend: URL input → loading state → script review → video player
- [x] Branded share page metadata for generated videos (file-backed MVP store)
- [x] Storage provider abstraction with Turso share metadata and Grove proof-publishing hooks
- [x] Agent trace and canvas proof surfaced in the demo UI
- [x] Live demo: audience member gives Twitter handle → video plays in ~5 mins

---

## Phase 1 — Post-hackathon hardening (Week 1–2)

**Goal:** Make it reliable enough to actually use.

- [ ] Farcaster enrichment via TinyFish
- [ ] Facebook profile enrichment via TinyFish
- [x] Basic user-facing error states and non-blocking canvas/share fallback
- [x] Webhook support for HeyGen callbacks
- [x] Avatar V support
- [x] Rate limiting on core credit-sensitive API routes
- [x] Basic input validation (URL format check per platform)
- [x] Loading state with step-by-step progress (not just a spinner)
- [x] Copy-to-clipboard for branded share link when available
- [x] Basic analytics wiring via PostHog provider + funnel event helpers

---

## Phase 2 — Auth & Credits (Week 3–4)

**Goal:** Users can sign in, see a credit balance, and pay for usage.

- [x] Magic-link auth system (email → login link via Resend)
- [x] Session management with HMAC-signed cookies (`nuncio_account`)
- [x] Account menu in header (email, plan, balance, logout)
- [x] Credit ledger system (reserve → commit/refund pattern)
- [x] Credit costs defined per action (research, script, canvas, soundscape, render, translate, captions)
- [x] Credit enforcement on `/api/studio/enrich`, `/api/studio/iterate`, `/api/studio/hook/regenerate`
- [x] Anonymous trial credits (10 credits, configured via `NUNCIO_TRIAL_CREDITS`)
- [x] Stripe integration for Pro subscriptions ($39/mo, 200 credits) and credit packs (100/$15, 500/$99)
- [x] Stripe webhook processing (checkout, invoice, subscription events)
- [x] Stripe test-mode pricing page with credit packs
- [x] `NUNCIO_CREDITS_ENFORCED=true` toggle for gradual rollout

### Credit pricing model

| Action | Cost |
|--------|-----:|
| profile.research | 1 |
| script.generate | 1 |
| canvas.build | 1 |
| soundscape.generate | 1 |
| video.render | 8 |
| video.translate | 2 |
| captions.generate | 1 |
| preview.generate | 0 |

**Full pipeline:** 11 credits per 30s video.
**Pro margin:** ~48% at $39/mo, 200 credits, $1.12/variable cost.

See [`docs/CREDITS.md`](./CREDITS.md) for full cost model and provider pricing breakdown.

---

## Phase 3 — Batch campaigns (Week 4–5)

**Goal:** Enable sales/recruiting teams to run multi-profile campaigns.

- [x] In-memory batch queue with create/get/list/updateJob operations
- [x] Batch processing pipeline (enrich → script → canvas → render per URL)
- [x] `/api/batch` CRUD routes (POST create/trigger, GET list, PATCH retry)
- [x] `/api/batch/[id]` routes (GET single, DELETE)
- [x] `/batch` page with job-level detail and live auto-polling for running batches
- [x] Progress bars per batch (animated, percentage + count)
- [x] Job-level status display (queued → processing → completed/failed)
- [x] Retry button for failed batches
- [x] Delete button for completed/failed batches
- [x] Video link ("View") for completed jobs
- [x] Error messages displayed inline per job
- [x] Summary header (campaigns, profiles, completed, failed)
- [x] Email delivery integration (attach video link to outreach email)
- [x] CSV upload for batch URL import
- [x] Deduplication — don't regenerate if a video for that profile already exists within 30 days
- [x] Webhook on batch completion

---

## Phase 4 — Cinematic Layer

**Goal:** Transform "clinical" AI video into a high-production cinematic experience via generative soundscapes.

- [x] ElevenLabs service layer for Sound Effects API
- [x] Five-vibe preset system (tech-office, quiet-cafe, startup-hustle, zen-studio, city-pulse)
- [x] Soundscape generation integrated into Studio build pipeline
- [x] Soundscape credit cost (1 credit per generation)
- [x] TTS integration for voice-over (ElevenLabs Flash model)
- [x] Context-aware vibe generation — LLM picks soundscape prompt based on target industry
- [x] Layered audio player in `/v/[id]` with "ducking"
- [ ] Cinematic entrance — procedural SFX on video start
- [ ] Script-triggered Foley — sound effects synced to script keywords

---

## Phase 5 — Intelligence upgrades (Month 2–3)

**Goal:** Make the personalisation smarter.

- [ ] Recent activity enrichment — pull last 10 tweets/posts, not just bio
- [ ] Company enrichment — if LinkedIn shows a company, also enrich the company's website
- [ ] Tone matching — analyse the target's writing style and adjust script tone to match
- [ ] Multi-language delivery — auto-detect target's primary language, translate via HeyGen
- [ ] Script A/B variants — generate 2 script options, let sender pick before rendering
- [ ] Sender brief memory — remember past briefs so returning users don't re-enter context

---

## Phase 6 — Platform integrations (Month 3+)

**Goal:** Embed nuncio into existing workflows.

- [ ] HubSpot integration — generate video for any contact, embed link in contact record
- [ ] LinkedIn Sales Navigator extension
- [ ] Slack bot — `/nuncio @username` in a channel
- [ ] Zapier / Make connector
- [ ] API for third-party developers

---

## Phase 7 — Production hardening

**Goal:** Make the system reliable and observable for paying users.

- [x] Persistent batch queue (database-backed, survive restarts)
- [x] Persistent magic link tokens (database or Redis)
- [ ] Error monitoring (Sentry or similar)
- [x] User dashboard — account page with credit history, past videos, usage stats
- [x] Onboarding flow — first-visit modal with guided tips
- [ ] Studio page simplification — progressive disclosure of Hook Engine complexity
- [ ] Responsive email templates for magic links

---

## Product assessments

### Design (8/10)
Strong linear pipeline with smart fallbacks. Credit-as-single-currency model is well thought out.
The `/dashboard` page unifies Studio and Batch into a single post-login experience with recent
activity, credit balance, usage stats, and quick actions.

### UX improvements

- [x] Account dashboard (`/dashboard`) with credit history, usage stats, recent videos
- [x] Onboarding modal (3 tips, localStorage-tracked, dismissible, replayable from account menu)
- [x] Unified header navigation with Dashboard link
- [x] Account menu includes Dashboard link and "Show tips" replay
- [x] Cross-links between Studio and Batch pages
- [x] `/api/videos/recent` endpoint for per-workspace video listing
- [x] `workspaceId` tracking on share records for dashboard queries

### UI/UX (7/10)
Clean monochrome design, good motion polish. Account dashboard (`/dashboard`) shows credit
history, usage stats, recent videos and batch campaigns. Onboarding modal guides first-time
users through the core flow. Pricing page and account menu link to dashboard. Cross-links
between Studio and Batch improve discoverability.

### System Architecture (8/10)
Clean separation of concerns, excellent fallback chains, production-grade credit reservation
pattern. Weak spots: in-memory queues/tokens (lost on restart), no error monitoring.

### Intuitiveness (5/10)
Core "paste URL → get video" is simple. But Hook Engine archetypes, format decisioning, canvas
nodes, and vibe selection add significant cognitive overhead for new users.

---

## Known constraints

- **HeyGen generation time:** 60–180 seconds per video. Cannot be made faster.
- **TinyFish login walls:** LinkedIn, Facebook, and some Twitter profiles require authentication.
- **In-memory state:** Batch queue and magic link tokens now persisted via file or Turso storage
  providers (determined by `TURSO_DATABASE_URL`). Survives restarts. Ready for horizontal scaling.
- **Stripe test mode:** All payments are in Stripe test mode. Switch to live mode before accepting
  real payments.

---

## Icebox (not planned, but noted)

- Real-time streaming video generation
- On-device voice cloning
- Video personalisation with the target's own face/voice (deepfake — explicitly out of scope)
- Browser extension for one-click video generation from a LinkedIn profile page
