# Strategy — The Wedge and the Secret

> Single source of truth for nuncio's positioning thesis, first market, plan, and kill criteria.
> Other docs (ROADMAP, ARCHITECTURE, LIVELINK_VENDOR_EVAL, DESIGN) reference this file; they do not restate the strategy.

---

## The thesis (one sentence)

**In the age of infinite AI content, the scarce resource in sales is credible presence — so instead of replacing the seller with a disguised AI employee (11x) or upgrading the medium (Tavus), make the actual seller honestly present at every first touch, at any hour, where the artifact doesn't advertise the conversation — it *is* the conversation.**

Recorded video is the fallback artifact inside the live link. Live conversation is the product. The `SenderPlaybook` is the compounding moat. The schlep (latency, guardrails, booking, compliance) is the barrier to entry.

The SDR opens the relationship; the twin maintains continuity; the actual sender joins when both parties want to talk. The card/live link is a personal front door, not a compulsory AI qualification step. Recipients can ask the twin, request the sender now, or choose a time. Availability is an explicit expiring sender setting, never inferred from a calendar gap. No promise of human availability or connection before owner acceptance and actual room presence. The twin is a bridge to the sender, not a replacement.

---

## Incumbent orthodoxies (what we attack)

| Player | Core belief | Hidden assumption |
|---|---|---|
| **11x / Artisan** | SDR labor can be replaced by a fictional AI "employee" | Disguise works; volume still compounds; sender identity doesn't matter |
| **Tavus / HeyGen / Synthesia** | Avatars are a *medium upgrade* over email; scale one recording into 1,000 variants | The avatar is the product; vendor APIs already expose conversation/tooling primitives — the differentiation is the authorized sender's judgment, workflow, and human handoff, not exclusive realtime capability |
| **Both camps** | The game is "get attention at scale" | Attention isn't scarce anymore — *credibility* is |

## The secrets

Evaluated on four criteria: contrary to incumbent beliefs, plausibly true, actionable now, monopoly-accumulating when acted on.

- **S1 — Identity is the product, not the labor.** *(core)* In a world of infinite generated content, the only unforgeable asset in sales is a real person's verified identity and judgment. Prospects don't want to meet an AI employee — they want the person who can actually say yes. Founders *are* that person; today their presence doesn't scale. 11x can't copy this without killing their "fire your SDRs" pitch; Avatar vendors already supply conversation and tools; nuncio's bet is that approved sender judgment, relationship context, and the human handoff form a differentiated workflow, not an exclusive rendering capability.
- **S2 — Honest AI beats disguised AI.** 11x's model depends on the prospect initially believing a human wrote the email — a decaying asset (detection improves, backlash grows, regulation arrives: CA SB 1001, EU AI Act transparency). Disclosure is a *feature*: "This is my AI twin, trained on my face, voice and playbook, so you can get real answers at 11pm" builds more trust than a fake human email.
- **S3 — The demo is the first call.** Every outbound artifact today is an advertisement for a future conversation. The live link collapses the two: the artifact *is* the conversation. The funnel step "get them to agree to a call" disappears — the call starts at first touch, on the prospect's schedule, with booking inside the conversation.
- **S4 — Prospects prefer the founder's twin to the founder's calendar.** *(behavioral bet, cheap to test)* Scheduling is friction. A twin available at 11pm that answers without pressure and lets the prospect self-qualify may convert better than a Calendly link. If false: retreat to recorded video + booking CTA, lose little.
- **S5 — The playbook is the asset; models are commodities.** *(the moat)* We're built on HeyGen/ElevenLabs APIs — so is everyone else; rendering commoditizes. The durable asset is the codified selling knowledge of one specific person (objections, stories, pricing judgment). Whoever owns the `SenderPlaybook` owns the relationship. Those APIs can't move up-stack into conversation + booking + per-sender playbooks without competing with their own customers.
- **S6 — The recipient is the next sender.** *(distribution)* B2B sales is a graph where nearly every node is both buyer and seller. Every `/v/[id]` and `/live/[id]` artifact demos the product to a future customer — and 11x *cannot* self-advertise inside its emails without breaking the disguise. Zero-virality has been a structural property of outbound tools until now.

**Synthesis:** S1 + S2 + S3 are the thesis; S5 is the moat; S6 is distribution.

**Fallback thesis** (if live conversations flop): *"Research-grade first touch"* — depth of research, not volume, earns attention. Scaffolding already exists (research quality gate, TinyFish enrichment, Twitter de-biasing). Weaker monopoly, but live.

## First market

**Seed-stage founders doing founder-led outbound.** Small, concentrated, reachable (Twitter, YC networks, founder groups), and the founder *is* the face of the company — an avatar of the founder is maximally coherent. Selection criterion for early users: they currently hand-record Looms or hand-write personalized email (duct-taped manual version of the product = acute pain).

Concentric expansion (gated on Phase 2 results): founders → high-ticket service sellers (consultants, agencies) → boutique recruiting/RE → eventually SDR orgs.

---

## The plan

### Phase 1 — Commit and instrument (weeks 1–2)

**The three falsifiable predictions (derived, thresholds set in advance):**

- **P-a — Disclosed twin beats disguised AI email on reply quality.** *(tests S2)*
  - **Metric:** qualified-reply rate = replies classified `interested` or `question` ÷ delivered artifacts, per arm (via the Resend → reply-webhook LLM classification that already exists). Guardrail: unsubscribe/complaint rate.
  - **Threshold:** twin arm ≥ **1.5×** the disguised-email arm on qualified-reply rate after ≥ 100 sends per arm, with unsubscribe rate no worse. Below parity → S2 is false, disclosure is not the asset we think it is.
- **P-b — Live-link conversation starts predict meetings better than video watch-through.** *(tests S3)*
  - **Metric:** P(meeting booked | `live_session_started`) vs P(meeting booked | `video_watch_through`), tracked per artifact.
  - **Threshold:** live-start conversion ≥ **2×** watch-through conversion after ≥ 50 started sessions and ≥ 50 watch-throughs. If not, the live link is an engagement toy, not a funnel collapse — S3 weakens and the artifact goes back to advertising a future call.
- **P-c — Twin ≥ Calendly CTA on meetings-per-send.** *(tests S4)*
  - **Metric:** meetings booked (`booking_clicked` on `/live/[id]` or `/v/[id]`) ÷ artifacts sent, per arm: live link with in-conversation booking vs recorded video + scheduling CTA.
  - **Threshold:** non-inferiority at ≥ **0.8×**, superiority target **1.5×**, ≥ 100 sends per arm. Below 0.8× → S4 false → recorded video + booking CTA becomes the product, live becomes a premium tier (falsification criterion 1).

- Flip `deliveryMode` defaults: live link is the **primary** artifact; recorded video is the fallback inside it (livelink-ready state, `/live/[id]` resilience, and fallback-to-video wiring already exist — mostly framing + defaults).
- Instrument live sessions: started, turns, **question topics**, booking event, drop-off point. Question topics write the playbook spec. Persisted as `LiveSessionRecord.metrics` (`userTurns`, `agentTurns`, `questionTopics` — classified bucket labels only, never raw transcript, `bookingClicked`, `lastEvent` drop-off marker); heartbeated during the session and finalized via `/api/live/sync`. PostHog events: `live_session_*`, `booking_clicked`, `video_watch_through`.

### Phase 2 — Ten founders, hand-served (weeks 2–6)
- Recruit 10 seed founders doing founder-led outbound.
- ~~Hand-build their `SenderPlaybook` via 30-minute interviews — use the existing voice overlay as the capture instrument; productize the motion later.~~ ✅ **Shipped:** voice overlay now supports a `playbook` mode that extracts and persists the full `SenderPlaybook` + sender identity.
- Sit in on live sessions; log every guardrail failure; tune. This schlep becomes the moat.
- Run Sean Ellis ("how disappointed if nuncio disappeared?") + willingness-to-pay. **Gate everything after this on ≥ 40%.**

### Phase 3 — Positioning rewrite (parallel with Phase 2)
- Kill "AI-powered · personalised video" as the headline. Move to the honest-twin frame: *"Your AI twin takes the first meeting"* / *"Meet [Founder] — anytime"*, disclosure worn as a badge.
- Turn the share page into the viral surface: "How this was made" trace becomes an explicit recipient→sender signup loop.
- Experiment with the value metric: credits fine for trial, anchor migrates toward **meetings booked**. Never price "more sends."

### Phase 4 — Concentric expansion (months 3–6, gated)
- Only after Phase 2 passes: high-ticket service sellers.
- Hermes autonomous mode becomes the scale layer *now*, not before — autonomy on top of hand-proven playbooks. Hybrid review mode is the correct default.

## Stop doing
- Anything framed around volume (batch-for-batch's-sake, "send more" language).
- SDR-team features.
- Competing on video render quality.
- (Keep multi-language — it amplifies presence, not volume.)

## Falsification criteria (decided in advance)
1. Prospects consistently refuse the twin and ask for email/a real human → S4 false; recorded video becomes the product, live becomes premium tier.
2. Founders won't let an AI answer on their behalf even with guardrails + transcript review → bottleneck is sender-side; pivot toward approval-first hybrid mode.
3. Sean Ellis < 40% after 10 hand-served founders → wedge isn't sharp; fall back to research-grade-first-touch thesis.
4. HeyGen/ElevenLabs ship the full conversation+booking stack → accelerate playbook data accumulation + recipient→sender loop; that's the ground they can't take.

## Scoreboard
- **North star:** meetings booked per artifact sent (`booking_clicked` ÷ artifacts sent).
- **Call-request metrics** (the twin→human bridge): call-request acceptance = accepted requests / created requests; connection success = requests with both authenticated owner and recipient observed in room / accepted requests; owner response latency = acceptedAt - createdAt; human connection latency = first joint room presence - createdAt. Booking clicks are a proxy, not confirmed meetings. These definitions are fixed; no new thresholds until the pilot produces data.
- Conversation-start rate (`live_session_connected` ÷ live-link page loads) and median turns (`LiveSessionRecord.metrics.userTurns`) on live links.
- Question-topic distribution (`metrics.questionTopics`) → playbook coverage gaps.
- Video control arm: `video_watch_through` rate for P-b comparison.
- Recipient→sender conversion coefficient (`viral_cta_clicked` → `viral_landing` → signup).
- Sean Ellis %.

> **Shipped:** a `ScoreboardCard` on `/dashboard` surfaces live-session aggregates from `GET /api/live/sessions` — total sessions, "Spoke to AI" rate, "Ended", "Booking clicks", median user turns, median duration, and a question-topic distribution bar chart — labeled as recent ended/expired/failed sessions, not page-load conversion.

## The first move
Pick the thesis sentence, get **one** founder's twin live this week, and watch a real prospect talk to it. Everything else — including which secret is actually true — gets answered by that conversation.

---

## Application: OpenClaw 2.0 first-hire hackathon (Sep 2026)

How the thesis maps to the AgentCribs "build your startup's first hire" contest
(submission Sep 29, leaderboard snapshot Sep 30 — score = valid users × tokens,
200k+ tokens per valid user, top 5 judged by AgentCribs/TPW).

**Positioning test.** "Research agent" is commoditized — research is plumbing,
never the story. The lead line: **an SDR that doesn't send outreach — it holds
the first conversation.** Every competing Index entry is an *assistant*
(helps the owner: recaps, household, social). Nuncio is the only *hire* — an
agent that works a job against real third parties on the owner's behalf.

**Why the hackathon multiplayer requirement favors us.** Most entries'
multiplayer is two teammates watching one session. Ours is a prospect —
a stranger — in an untrusted thread negotiating with the twin while the owner
watches and approves. That is the rule's actual intent ("customers and
vendors interface with it") and nobody else does it.

**The judge-facing demo.** Put the judge in the prospect seat: owner texts a
URL → onboarding/playbook → research → approved first touch → prospect (the
audience) replies with an objection → twin handles it from the playbook →
escalates to owner → booking link → Stripe checkout. Every requirement
visible in 60s: multiplayer, real job, real third party, real money.

**Token-economics design consequences.** An approval-gated SDR burns fewer
tokens than a chatty assistant, so the loop is deliberately conversational:
playbook onboarding interview, in-chat draft iteration, follow-up threads —
plus a daily SDR briefing heartbeat for habitual opens (valid-user floor).

**What the hackathon falsifies.** S2 (disclosed twin vs disguise) and S4
(prospect prefers twin to calendar) get their first real-world reads for free.
If prospects refuse the twin in threads, that is cheap, high-quality evidence
against the thesis — the contest is the experiment.

**Moat logic unchanged.** The playbook interview is PG's unscalable thing
productized; guardrails + escalation + disclosure UX are the schlep others
route around. Rendering providers stay commodities (S5).
