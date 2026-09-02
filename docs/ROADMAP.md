# Roadmap

## Status

nuncio is in production. The core multi-agent pipeline — research → write → validate → render — is live with:
- Band multi-agent coordination
- TinyFish enrichment
- Claude/Featherless script generation
- ElevenLabs audio (soundscape, cinematic entrance)
- HeyGen video rendering
- Speechmatics captions
- Branded share pages
- Demo mode (`?demo=true`)

---

## Strategic Direction

Positioning, first market, phased plan, falsification criteria, and scoreboard live in **`docs/STRATEGY.md`** (single source of truth — do not restate here). One-paragraph summary:

nuncio's thesis is that the scarce resource in sales is no longer attention but **credible presence**. The product makes the actual sender honestly present at every first touch — a live AI twin (face, voice, `SenderPlaybook`) where the artifact *is* the conversation, not an ad for one. Recorded HeyGen video is the fallback artifact inside the live link. This file tracks the **engineering roadmap** underneath that thesis.

## Current Focus

### Recently completed
- **Playbook capture via voice overlay** — `VoiceOverlay` supports `campaign` and `playbook` modes; extraction prompts capture full `SenderPlaybook` + sender identity; studio persists to `/api/account/brief`.
- **Live scoreboard dashboard** — `ScoreboardCard` surfaces `GET /api/live/sessions` aggregates (start rate, bookings, median turns/duration, question-topic distribution).
- **UI consistency / Lottie loading pass** — replaced CSS/text loaders with `LottieIcon` across dashboard, studio, pricing, login, batch, share pages, and video captions/translate states.

### Conversational SDR / LiveLink

Per `docs/STRATEGY.md`, the live link is becoming the **primary artifact** with recorded video as its fallback (STRATEGY Phase 1). Provider posture: **HeyGen remains the default recorded-video layer; Anam is the experimental live-conversation layer**, opt-in via `NUNCIO_LIVELINK_ENABLED=true` and limited to one sender during validation. HeyGen LiveAvatar Lite is retained as fallback vendor; do not build both live providers during the first experiment.

The next goal is not broad commercialization; it is to prove that an honest, disclosed AI twin of the sender increases qualified conversations and booked meetings enough to justify live-session cost and operational complexity (see STRATEGY falsification criteria).

#### LiveLink decision gate

- **Default:** recorded HeyGen video remains available and unchanged.
- **Experimental path:** Anam LiveLink is now opt-in via `NUNCIO_LIVELINK_ENABLED=true`; keep it limited to one sender during validation. Workspace/sender allowlisting remains planned.
- **Fallback (planned):** if the live session fails, expires, or is unavailable, preserve the recorded share experience rather than showing a dead end.
- **Commercial posture:** do not call LiveLink a paid upsell until the pilot demonstrates conversion lift, acceptable latency, predictable cost per booked meeting, and safe playbook adherence.
- **Fallback vendor:** retain HeyGen LiveAvatar Lite as a later option; do not build both live providers during the first experiment.

#### LiveLink implementation plan

**Phase 0 — Stabilise the existing path**

- Confirm `/live/[id]`, `/api/live/session`, Anam SDK versions, and required production secrets.
- ✅ Keep Anam disabled by default behind the server-side `NUNCIO_LIVELINK_ENABLED` gate.
- Add provider-neutral session status/error handling so the share link can fall back to the recorded video (planned; current page still shows retry/error state).
- Keep the existing research → synthesis → Sender Playbook pipeline as the single source of context.

**Phase 1 — Make the experiment safe and measurable**

- ✅ Add server-side feature gating and a five-minute browser-side maximum session duration; workspace/sender allowlisting remains.
- Add idle timeout and server-side cleanup/reconciliation; the current cap and client cleanup are spend guardrails, not duration-aware billing.
- ✅ Add client-side lifecycle analytics for requested, connected, ended, and failed sessions; durable server-side duration/provider/outcome recording remains.
- Make the live prompt explicitly identify the avatar as AI and enforce hard constraints before adding booking tools.
- Add a mockable provider boundary and credit-safe tests before repeated external calls.

**Phase 2 — Run the pilot**

- Use one sender/avatar and 5–10 friendly or real prospects.
- Compare a HeyGen-only cohort with a HeyGen-plus-LiveLink cohort where practical.
- Measure video click → live-session start, session completion, qualified reply, booked meeting, p50/p95 response latency, fallback rate, and cost per booked meeting.
- Keep sessions short and capped; treat the pilot as a conversion experiment, not a scale launch.

**Phase 3 — Commercial decision**

Make LiveLink a premium feature only if it shows meaningful conversion lift, acceptable mobile/browser reliability, no material guardrail or likeness failures, and a cost per booked meeting that supports margin. Otherwise keep it as an internal/demo capability and continue improving the recorded HeyGen experience.

#### Pilot go/no-go criteria

- **Go:** measurable lift in qualified conversations or meetings, p95 turn latency that feels natural, predictable live cost, and zero critical playbook violations.
- **Hold:** promising engagement but insufficient sample size, high variance, or unresolved mobile/latency issues.
- **No-go:** no conversion lift, uncontrolled session spend, repeated hallucinations, or unacceptable consent/likeness risk.

After the gate passes, the account-specific video compositions below become supporting assets that the live agent can also show or reference during conversation.

### Strategic Account Videos

Supports the recorded-artifact side of the thesis (fallback inside the live link). Narrow wedge: founders and small B2B teams pursuing high-value accounts, partnerships, investors, and other conversations where one thoughtful first message can change the relationship.

The product should not feel like another outbound sequence tool — and per STRATEGY's stop-doing list, never like a volume tool. It should feel like the fastest way to produce the account-specific video the sender would make manually if they had enough time.

- [x] Reposition landing page around high-value accounts, human review, and one-person-at-a-time quality
- [x] Reframe studio input around account, reason, review, and send
- [ ] Add visual proof inputs so videos can include sender-specific assets and recipient-specific context
- [ ] Build one polished account-film composition before adding format or template breadth
- [ ] Instrument the funnel from account added to reply or meeting outcome

### Visual Personalisation

The current vocal personalisation is stronger than the visual personalisation. The next product push should make each output look made for the recipient, not just sound like it was written for them.

Target composition:

1. **0-3s: target-specific hook** - recipient name, company, recent post, site, product, or relevant public signal.
2. **3-12s: why now** - a simple motion graphic that makes the reason for reaching out visible.
3. **12-22s: proof or offer** - sender product screenshot, result, customer proof, or relevant asset.
4. **22-30s: human close** - avatar or voice-led close with one clear next step.

Avatar remains useful, but it should be one ingredient in an account-specific film rather than the whole visual experience.

### Validation

Use London founder/operator access as a practical test bed before broadening the market.

- Pick two real products the team already wants to use nuncio for
- Choose 3-5 actual target accounts per product
- Produce current avatar-led videos and the new proof-first composition for the same accounts
- Show or send them to relevant founders, operators, and sales leads
- Ask which version feels actually made for them, whether they would send it, and what looks generic
- Treat repeat usage as the core signal: would they create another account-specific video without prompting?

---

## Next Steps

Sequencing and gates come from `docs/STRATEGY.md` phases. Engineering items:

### STRATEGY Phase 1 — commit and instrument
1. ~~**Live-link-first defaults**~~ ✅ — studio + `/api/share` + `/api/pipeline` default to livelink when the pilot allows; explicit `video` always respected; recorded video remains the fallback inside the live link
2. ~~**Live-session instrumentation**~~ ✅ — started, turns, question topics (classified labels only, never raw transcript), booking event, drop-off marker persisted as `LiveSessionRecord.metrics`; 15s heartbeats + terminal sync via `/api/live/sync`; read path `GET /api/live/sessions`
3. **LiveLink experiment controls** — allowlist, idle timeout, fallback, provider-neutral errors (feature gate and initial session cap are in place)
4. **Guardrails and booking integration** — hard constraints, explicit AI disclosure (S2: disclosure as a feature), fallback answers, calendar booking (booking-link field + on-page CTA + prompt guidance shipped; guardrail tuning continues in Phase 2)
5. **Reply-to-live escalation** — email replies can open a live avatar session instead of static follow-up (the artifact stays a conversation)

### STRATEGY Phase 2 — ten founders, hand-served
6. ~~**Playbook capture**~~ ✅ — `VoiceOverlay` now supports `campaign` and `playbook` modes; extraction prompts capture sender identity + `SenderPlaybook` fields (`offer`, `wants`, `wiggleRoom`, `constraints`, `bookingUrl`, `senderBusiness`, `senderBrand`, `senderPersonality`, `senderAudience`, `senderOffer`, `senderProofPoints`); studio applies and persists them via `/api/account/brief`.
7. **LiveLink pilot** — one Anam sender/avatar, 5–10 prospects, explicit AI disclosure, short capped sessions, HeyGen-only comparison where practical
8. ~~**Outcome tracking**~~ ✅ — lifecycle events already emitted (`live_session_*`, `booking_clicked`, `video_watch_through`); new `ScoreboardCard` on `/dashboard` surfaces start rate, bookings, median turns/duration, and question-topic distribution from `GET /api/live/sessions`.
9. **Pre-send review** — research, hook, script, and visual plan reviewable before credits are spent

### STRATEGY Phase 3 — positioning rewrite (parallel)
10. ~~**Share-page viral loop**~~ ✅ — `/v/[id]` CTA rewritten as recipient→sender signup loop with `?ref=share-{id}` tracking; live-page footer carries `?ref=live-{id}`; landing captures `ref` via `trackViralLanding`
11. ~~**Honest-twin framing**~~ ✅ — "AI-powered · personalised video" killed across studio badge, landing, metadata, share/live pages; disclosure worn as a badge ("disclosed, never disguised"). Remaining: trust signals (sender photo, verified badge)
12. ~~**Value-metric experiment**~~ ✅ (copy anchor) — pricing anchored to meetings booked / twin first touches; "we never charge for more sends". Remaining: report meetings booked per workspace once booking data accumulates

### Artifact quality (supports recorded fallback)
13. **Visual proof brief** — collect 1–3 sender assets: product screenshot, logo, proof point, case study, deck slide, or relevant URL
14. **Proof-first render path** — one reusable composition combining recipient research, sender asset, motion graphic, and avatar close
15. **LinkedIn-first format** — optimise one aspect ratio and playback context before expanding
16. **Playbook templates** — opinionated flows: investor intro, strategic customer, partnership, recruiting, founder-to-founder

### Lower Priority
1. **Persistent magic links** — move from in-memory to Turso/file storage
2. **One video player** — unify `/v/[id]` and `VideoPlayer` components
3. **Multi-language delivery** — auto-detect target language, offer in studio UI (kept: amplifies presence, not volume)
4. **Credit spend transparency** — show credits spent this session on the ready screen; replace token-start reservation with duration-aware live usage reconciliation before commercialization

### Suggested immediate next steps
1. **Reply-to-live escalation** — email replies can open a live avatar session instead of static follow-up (keeps the artifact as a conversation).
2. **LiveLink pilot guardrails** — idle timeout, server-side duration-aware cleanup, provider-neutral error fallback, and workspace/sender allowlist before running the Anam pilot.
3. **Pre-send review** — let users review research, hook, script, and visual plan before credits are spent.
4. **Share-page trust signals** — sender photo, company logo, or verified-sender badge on `/v/[id]` and `/live/[id]`.
5. **Visual proof brief** — collect 1–3 sender assets (screenshot, logo, proof point, case study, deck slide) and wire them into a proof-first composition.

---

## Known Constraints

- **HeyGen generation time:** 60–180 seconds per video
- **LiveLink:** Anam session minutes and concurrency are metered; token creation is not a reliable proxy for actual session cost until lifecycle reconciliation is implemented
- **TinyFish login walls:** Some profiles require authentication
- **In-memory magic link tokens:** Single-instance limitation

---

## Still to do

### Redis-backed rate limiter deployment
The rate limiter (`src/lib/rate-limit.ts`) now supports Redis for cross-instance, restart-safe rate limiting. It is currently deployed in code but **not enabled in production**:
- Set `NUNCIO_RATE_LIMIT_STORE=redis` in production environment variables
- Provide a real `REDIS_URL` (e.g., Upstash / Redis Cloud)
- Redeploy and verify `/api/*` routes still enforce limits correctly


---

## Icebox (Out of Scope)

- Real-time streaming video generation
- On-device voice cloning
- Video personalization with target's face/voice (deepfake — explicitly out)
- General-purpose motion graphics editor
- Broad template marketplace
- Browser extension
