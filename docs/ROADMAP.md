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

nuncio is redefining the category from "AI video outreach" to **conversational SDR** — a live AI avatar of the sender that prospects can actually talk to, negotiate with, and book meetings with.

- **Recorded video is the wedge**: a personalized 30–60s HeyGen video breaks through noise and creates trust at scale.
- **Live conversation is the product**: a real-time avatar session (Anam / HeyGen LiveAvatar + low-latency voice) lets the prospect ask questions, object, and negotiate.
- **Sender Playbook is the control layer**: structured capture of intent, offer, constraints, and wiggle room keeps the agent on-message without micromanagement.

## Current Focus

### Conversational SDR / LiveLink

The product decision is to keep **HeyGen as the default recorded-video wedge** and use **Anam as the experimental live-conversation layer**. This is not a second video-rendering product or an immediate provider migration:

> HeyGen gets the prospect's attention; Anam helps convert interest into a conversation and, eventually, a meeting.

The existing LiveLink page and Anam session-token path are the technical starting point. The next goal is not broad commercialization; it is to prove that an AI version of the sender increases qualified conversations and booked meetings enough to justify live-session cost and operational complexity.

After LiveLink is proven end-to-end, account-specific video compositions become supporting assets that the live agent can also show or reference during conversation.

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

nuncio is being sharpened around a narrower wedge: founders and small B2B teams pursuing high-value accounts, partnerships, investors, and other conversations where one thoughtful first message can change the relationship.

The product should not feel like another outbound sequence tool. It should feel like the fastest way to produce the account-specific video the sender would make manually if they had enough time.

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

### Strategic (LiveLink / Conversational SDR)
1. ✅ **Sender playbook data model** — capture wants, offers, constraints, and wiggle room
2. ✅ **Voice agent playbook extraction** — gather playbook fields conversationally
3. ✅ **Pipeline delivery mode** — add `video` / `livelink` mode to pipeline input
4. ✅ **LiveLink share + studio wiring** — `deliveryMode` on `ShareRecord`, `/api/share` handles livelink, studio client creates live share + QuickReady shows live link card
5. ✅ **LiveLink conversation page (initial path)** — `/live/[id]` and `/api/live/session` use Anam; production hardening and pilot controls remain
6. **LiveLink experiment controls** — allowlist, idle timeout, fallback, and provider-neutral errors (feature gate and initial session cap are in place)
7. **Guardrails and booking integration** — hard constraints, explicit AI disclosure, fallback answers, and calendar booking
8. **LiveLink measurement** — session lifecycle, latency, cost, failure, and meeting-outcome events
9. **Reply-to-live escalation** — email replies can open a live avatar session instead of static follow-up

### High Priority
1. **LiveLink pilot** - one Anam sender/avatar, 5-10 prospects, explicit AI disclosure, short capped sessions, and a HeyGen-only comparison where practical
2. **Visual proof brief** - collect 1-3 sender assets: product screenshot, logo, proof point, case study, deck slide, or relevant URL
3. **Proof-first render path** - create one reusable composition that combines recipient research, sender asset, motion graphic, and avatar close
4. **Pre-send review** - make the research, hook, script, and visual plan reviewable before credits are spent
5. **Outcome tracking** - capture sent, watched, replied, meeting booked, live-session-started, live-session-completed, live-session-failed, duration, and second-video-created events

### Medium Priority
1. **LinkedIn-first format** - optimise one aspect ratio and playback context before expanding to Instagram, X, and other channels
2. **Playbooks** - create a small set of opinionated flows: investor intro, strategic customer, partnership, recruiting, founder-to-founder
3. **Credit spend transparency** - show credits spent during the current session on the ready screen; replace the current token-start reservation with duration-aware live usage reconciliation before commercialization

### Lower Priority
1. **Persistent magic links** — move from in-memory to Turso/file storage
2. **One video player** — unify `/v/[id]` and `VideoPlayer` components
3. **Multi-language delivery** - auto-detect target language, offer in studio UI

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
