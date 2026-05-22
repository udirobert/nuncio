# Roadmap

## Status

nuncio is in production. The core pipeline — enrichment → script → canvas → video — is live at
[nuncio.persidian.com](https://nuncio.persidian.com) with credit enforcement, Stripe payments,
magic-link auth, batch campaign support, persistent state, cinematic soundscapes with ducking,
recent activity/company enrichment, tone matching, script A/B variants, sender brief memory,
multi-language delivery, account dashboard, onboarding walkthrough, Sentry error monitoring,
responsive email templates, and progressive disclosure studio UI.

All provider integrations (TinyFish, Featherless, HeyGen, Melius, ElevenLabs, Speechmatics) are active.

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
- [x] Cinematic entrance — 3s SFX on play click, generated via ElevenLabs per vibe
- [x] Foley — sound effects generation is technically wired but not script-triggered

---

## Phase 5 — Intelligence upgrades (Month 2–3)

**Goal:** Make the personalisation smarter.

- [x] Recent activity enrichment — pull last 10 tweets/posts, not just bio
- [x] Company enrichment — if LinkedIn shows a company, also enrich the company's website
- [x] Tone matching — analyse the target's writing style and adjust script tone to match
- [x] Multi-language delivery — auto-detect target language from profile content, write script in that language, language selector in studio review, language badge on video page
- [x] Script A/B variants — generate 2 script options, let sender pick before rendering (advanced mode only)
- [x] Sender brief memory — remember past briefs via workspace account storage

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
- [ ] Persistent magic link tokens (database-backed) — currently in-memory `Map`
- [x] Error monitoring (Sentry — @sentry/nextjs v10 via instrumentation.ts + withSentryConfig)
- [x] User dashboard — `/dashboard` with credit history, past videos, usage stats, quick actions
- [x] Onboarding flow — first-visit modal with guided tips, localStorage-tracked
- [x] Cross-linking — Studio↔Batch links, Dashboard in header & account menu, post-login redirect
- [x] `workspaceId` on share records — enables per-workspace video queries in dashboard
- [x] `GET /api/videos/recent` — endpoint for per-workspace video listing
- [x] Studio simplification — collapsible profile editor, read-only script preview by default, collapsible hook info, sticky build button, advanced settings behind toggle (quick mode)
- [x] Responsive email templates — full `<html>` wrapper with `<style>` block and mobile-first media queries

---

## Phase 8 — Polish to 9/10

**Goal:** Move from 7/10 product to 9/10 across architecture, UI/UX, and intuitiveness.

Current scores: Product 7/10 · Architecture 7/10 · UI/UX 8/10 · Intuitiveness 6/10
Target:  Product 9/10 · Architecture 9/10 · UI/UX 9/10 · Intuitiveness 9/10

### A — Kill the God Component (Architecture)

**Problem:** `studio-client.tsx` is 2300+ lines with 45 raw `useState` calls.

**Solution:** Extract the 4 stage render blocks into standalone components in
`src/components/studio/`, each with its own focused state. Replace raw state
orchestration with `useReducer` defining a type-safe state machine:
`input→enriching→review→building→ready→error`.

**Effort:** 3-4 hours. Risk: moderate.

### B — One Video Player (Architecture + UI/UX)

**Problem:** `/v/[id]` and `VideoPlayer` (`src/components/video-player.tsx`) handle
captions, language, and translation differently. The video page has an empty `<track>`;
VideoPlayer has full VTT + TranslateButton.

**Solution:** Delegate both to a shared `VideoPlayerCore` component. CaptionTrack,
TranslateButton, and DuckingAudio live in the core; page-specific shells add
cinematic entrance overlay and share-nuncio footer respectively.

**Effort:** 2-3 hours. Risk: low.

### C — Demystify the Nomenclature (Intuitiveness)

| Term | Fix |
|---|---|
| "Build on Melius" | Change to **"Build video"** , add `(powered by Melius)` as tiny footnote |
| "Hook" / "Archetype" | Show inline descriptions next to each archetype button |
| "Soundscape" / "Vibe" / "Cinematic entrance" | Group into one **"Audio"** card with a single vibe selector |
| Credits | Show cost breakdown as tooltip on build button: "11 credits: research (1) + script (1) + ..." |

**Effort:** 1-2 hours. Risk: none.

### D — Mobile Responsiveness Pass (UI/UX)

**Test and fix on actual devices:**

| Page | Likely issues |
|---|---|
| `/studio` | Grid breaks, canvas animation overflows, sticky button padding |
| `/v/[id]` | Video controls on iOS Safari |
| `/dashboard` | Cards stack, table wraps |
| `/batch` | Job table scroll, progress bars |
| Header nav | Links overflow — collapse to hamburger |

**Effort:** 2-3 hours. Risk: low.

### E — Email Gate UX (Product + Intuitiveness)

**Problem:** Email capture dialog appears without context.

**Fix:** Add explainer tooltip before modal: "We'll send the link to your email so
you don't lose it." Update modal copy per intent. Show credit cost before render.

**Effort:** 1 hour. Risk: none.

### F — Use After Render (Product)

**Problem:** No feedback after sending a video.

**Add:** Lightweight view tracking on `/v/[id]` (`POST /api/share/[id]/viewed`),
"watched" badges in studio/dashboard, and a resend follow-up option.

**Effort:** 2-3 hours. Risk: low. **Highest-ROI missing feature** — turns nuncio
from a video generator into an outreach platform.

### G — Persistent Magic Link Tokens (Architecture)

**Problem:** Magic link tokens in-memory (`Map`). Restart kills pending links.
Can't scale to multi-instance.

**Solution:** Implement `MagicLinkStorageProvider` following the same pattern as
batch storage (file or Turso). TTL-based cleanup on read.

**Effort:** 1-2 hours. Risk: low.

### Effort Summary

| Item | Hours | Impact | Risk |
|---|---|---|---|
| A — Kill the god component | 3-4 | Architecture +++ | Medium |
| B — One video player | 2-3 | Architecture ++, UI/UX ++ | Low |
| C — Demystify nomenclature | 1-2 | Intuitiveness +++ | None |
| D — Mobile pass | 2-3 | UI/UX +++ | Low |
| E — Email gate UX | 1 | Product ++, Intuitiveness ++ | None |
| F — View tracking | 2-3 | Product +++ | Low |
| G — Persistent magic links | 1-2 | Architecture ++ | Low |
| **Total** | **14-21 hours** | | |

### Suggested Order

1. **C + E** (3 hours, zero risk, immediate perceptible improvement)
2. **F** (3 hours, highest ROI feature)
3. **D** (3 hours, catches real bugs)
4. **A** (4 hours, foundational refactor — do before adding more features)
5. **B** (3 hours, requires A to settle — studio ready stage touches extracted components)
6. **G** (2 hours, low priority if single-instance)

---

## Product assessments

### Product Design — 7/10
Strong core insight: personalised video outreach at scale, gated by email capture.
Hook engine archetypes are a real differentiator. The quick/advanced mode split
covers both casual and power users. Weak spots: no post-send feedback loop
(view tracking), email gate lacks context, and credit pricing is opaque at point
of action.

### System Architecture — 7/10
Solid Next.js App Router layout. Clean `/api/studio/*` and `/api/batch/*`
separation. SSE stream for build progress is elegant. Melius MCP integration
is a neat abstraction. Weak spots: `studio-client.tsx` is a 2300-line god
component, two diverged video players, magic link tokens in-memory, 45 raw
`useState` calls with no state machine.

### UI/UX — 8/10
Visually excellent — cream palette, motion design, cinematic entrance, animated
canvas. Quick mode flow is clean and focused. Weak spots: mobile likely has
layout issues, ready stage has too many buttons in advanced mode, the "Built on
Melius" badge means nothing to new users.

### Intuitiveness — 6/10
Core "paste URL → get video" is simple. Recent simplification work (collapsible
sections, progressive disclosure) helped. Weak spots: "Melius" unexplained,
"Soundscape vs Vibe vs Cinematic Entrance" is three names for one concept,
archetype names lack descriptions, credit costs invisible until the reservation
fails, email gate is abrupt.

---

## Known constraints

- **HeyGen generation time:** 60–180 seconds per video. Cannot be made faster.
- **TinyFish login walls:** LinkedIn, Facebook, and some Twitter profiles require authentication.
- **In-memory magic link tokens:** Pending persistent storage (tracked in Phase 8-G).
- **Stripe test mode:** All payments are in Stripe test mode. Switch to live mode before accepting
  real payments.

---

## Icebox (not planned, but noted)

- Script-triggered Foley — sound effects synced to script keywords
- Real-time streaming video generation
- On-device voice cloning
- Video personalisation with the target's own face/voice (deepfake — explicitly out of scope)
- Browser extension for one-click video generation from a LinkedIn profile page
