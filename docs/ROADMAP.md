# Roadmap

## Status

nuncio is in active development, built initially for the HeyGen Hackathon (May 14–15 2026) and extended for simultaneous submission to the Milan AI Week, TechEx, and Melius hackathons.

---

## Phase 0 — Hackathon MVP (May 14–15)

**Goal:** Working end-to-end pipeline that can demo live on stage.

- [x] TinyFish enrichment for LinkedIn + Twitter/X, plus GitHub/Farcaster/Facebook/personal URL validation
- [x] Claude/LLM two-pass synthesis (profile JSON + script) with Featherless fallback
- [x] HeyGen video creation via Video Agent with `/v3/videos` fallback
- [ ] Avatar V integration (launches May 18 — use Avatar IV as fallback for May 14–15 demo)
- [ ] Voice clone setup (pre-cloned, stored as env var)
- [x] Melius canvas creation + asset storage via MCP, with optional Fal image generation fallback
- [x] Polling endpoint for video status
- [x] Minimal frontend: URL input → loading state → script review → video player
- [x] Branded share page metadata for generated videos (file-backed MVP store)
- [x] Storage provider abstraction with Turso share metadata and Grove proof-publishing hooks
- [x] Agent trace and canvas proof surfaced in the demo UI
- [ ] Live demo: audience member gives Twitter handle → video plays in ~60s

**Out of scope for MVP:**
- User accounts
- Multiple sender profiles
- Video translation
- Farcaster / Facebook enrichment
- Webhook-based delivery (polling only)

---

## Phase 1 — Post-hackathon hardening (Week 1–2)

**Goal:** Make it reliable enough to actually use.

- [ ] Farcaster enrichment via TinyFish
- [ ] Facebook profile enrichment via TinyFish
- [x] Basic user-facing error states and non-blocking canvas/share fallback
- [ ] Webhook support for HeyGen callbacks (replace polling)
- [ ] Avatar V once available (May 18)
- [ ] Rate limiting on API routes
- [x] Basic input validation (URL format check per platform)
- [x] Loading state with step-by-step progress (not just a spinner)
- [x] Copy-to-clipboard for branded share link when available
- [ ] Basic analytics (how many videos generated, average completion time)

---

## Phase 2 — Multi-sender support (Week 3–4)

**Goal:** Let more than one person use it with their own identity.

- [ ] Sender profile setup (name, voice clone, avatar selection)
- [ ] Voice clone UI — upload a 30-second clip, get a `voice_id` back
- [ ] Avatar selection from HeyGen library
- [ ] Sender brief template (default pitch, CTA, tone)
- [ ] Simple auth (email + magic link, no passwords)
- [ ] Session history — list of previously generated videos

---

## Phase 3 — Batch mode (Month 2)

**Goal:** Enable sales/recruiting teams to run campaigns.

- [ ] CSV upload — paste a list of LinkedIn URLs, generate a video for each
- [ ] Batch queue with progress dashboard
- [ ] Per-video status tracking in Melius canvas
- [ ] Email delivery integration (attach video link to outreach email)
- [ ] Deduplication — don't regenerate if a video for that profile already exists within 30 days
- [ ] Webhook on batch completion

---

## Phase 4 — Intelligence upgrades (Month 2–3)

**Goal:** Make the personalisation smarter.

- [ ] Recent activity enrichment — pull last 10 tweets/posts, not just bio
- [ ] Company enrichment — if LinkedIn shows a company, also enrich the company's website
- [ ] Tone matching — analyse the target's writing style and adjust script tone to match
- [ ] Multi-language delivery — auto-detect target's primary language from enrichment, translate video via HeyGen Video Translate + Lipsync
- [ ] Script A/B variants — generate 2 script options, let sender pick before rendering
- [ ] Sender brief memory — remember past briefs so returning users don't re-enter context

---

## Phase 5 — Platform integrations (Month 3+)

**Goal:** Embed nuncio into existing workflows.

- [ ] HubSpot integration — generate a video for any contact, embed link in contact record
- [ ] LinkedIn Sales Navigator extension
- [ ] Slack bot — `/nuncio @username` in a channel
- [ ] Zapier / Make connector
- [ ] API for third-party developers

---

## Known constraints

- **HeyGen generation time:** 60–180 seconds per video. Cannot be made faster — it is an upstream rendering constraint. UX must be designed around async delivery.
- **TinyFish login walls:** LinkedIn, Facebook, and some Twitter profiles may require authentication. TinyFish browser automation can handle this via Vault credentials, but setup requires per-platform session management. Not tackled until Phase 1+.
- **Avatar V availability:** Launches May 18. Hackathon demo on May 14–15 uses Avatar IV as fallback. Switch to V in Phase 1.
- **Voice clone quality:** HeyGen voice cloning requires a clean 30-second audio sample. Background noise or music degrades quality significantly. Document this clearly for users.
- **Melius MCP egress:** Uploading images to Melius requires network egress enabled in Claude organisation settings. Document in setup guide.
- **Stripe integration:** Infrastructure added (`/api/checkout`, `/api/webhook`), awaiting configuration. Free users get `privacy: "public"` videos; pro users get private videos + future features.

---

## Icebox (not planned, but noted)

- Real-time streaming video generation (not currently possible with HeyGen)
- On-device voice cloning
- Video personalisation with the target's own face/voice (deepfake — explicitly out of scope for ethical reasons)
- Browser extension for one-click video generation from a LinkedIn profile page