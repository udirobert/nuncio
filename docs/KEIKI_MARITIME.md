# Keiki × Maritime — Nuncio entry

## Programme

| Field | Value |
|-------|-------|
| **Programme** | Keiki × Maritime — build an always-on personal or business agent |
| **Goal** | Reach 1,000 users in six weeks |
| **Programme starts** | October 20, 2026 |
| **Programme ends** | December 1, 2026 |
| **Duration** | Six weeks |
| **Prize** | Up to $20,000 LLM credits + three-day trip to San Francisco (top 3 qualifying projects) |
| **Application** | Completed — accepted into the programme |
| **Competition** | https://competition.maritime.sh/ |

## User baseline (transparent)

| Metric | Value |
|--------|-------|
| **Users at programme start (Oct 20)** | 0 |
| **Users as of today** | 0 |
| **Target by Dec 1** | 1,000 |

We are starting from zero. Every user count below is real, instrumented, and updated weekly. No dashboard is invented until analytics exist (PostHog server-side capture already fires `signed_up`, `live_session_*`, `booking_clicked`, `video_watch_through`, `referred_signup`).

## Weekly tracking

| Week | Starts | Users at start | Users at end | New this week | Cumulative | Milestone |
|------|--------|----------------|--------------|---------------|------------|-----------|
| 1 | Oct 20 | 0 | | | | First artifact sent (`/v/[id]` or `/live/[id]`) |
| 2 | Oct 27 | | | | | Live sessions started + meetings booked instrumented |
| 3 | Nov 3 | | | | | Recipient→sender signup loop live on share pages |
| 4 | Nov 10 | | | | | Repeat senders ≥ 10% of base |
| 5 | Nov 17 | | | | | 500 cumulative users |
| 6 | Nov 24 | | | | | 1,000 cumulative users |

Update this table every Friday. The "Users at end" for a week becomes "Users at start" for the next.

## Project-specific metrics (feed the weekly table)

| # | Metric | What good looks like |
|---|--------|---------------------|
| 1 | Artifacts sent / week | Recorded videos or live links delivered to prospects |
| 2 | Live sessions started / week | Prospect opens `/live/[id]` and talks to the twin |
| 3 | Meetings booked / week | `booking_clicked` on `/live/[id]` or `/v/[id]` — north star |
| 4 | Recipient→sender signups / week | `viral_cta_clicked` → `viral_landing` → `referred_signup` — the viral loop |
| 5 | Repeat senders / week | ≥2 artifacts sent in 7 days (same workspace account) |
| 6 | Sean Ellis % | "How disappointed if nuncio disappeared?" — gate ≥ 40% before scaling |

## Mapping to existing docs

- `docs/STRATEGY.md` — the Scoreboard section already tracks meetings booked per artifact, call-request metrics, conversation-start rate, question-topic distribution, and Sean Ellis %. This Keiki × Maritime board is the **user-growth** overlay; STRATEGY.md remains the **strategy** source of truth. Both roll up into the same weekly user count.
- `docs/VIRAL-LOOP.md` — invite-flow teardown + K-factor worksheet for the recipient→sender signup loop (`?ref=share-{id}`, `?ref=live-{id}`).
- `docs/ROADMAP.md` — engineering roadmap; LiveLink gates and artifact quality.
- `AGENTS.md` — full project context including credit enforcement (`NUNCIO_CREDITS_ENFORCED=true`), 15 trial credits per visitor, and Stripe credit packs. Credits are the monetization meter; user growth is separate.
- Credit warning: every video render costs HeyGen + ElevenLabs + TinyFish. User growth must be paced against the $20k credit grant — see `AGENTS.md` credit-guard section.

## Notes

- This file is the single source of truth for Keiki × Maritime user tracking in Nuncio. Do not restate the user-count table elsewhere.
- Update weekly. If a week is missed, note the gap honestly rather than backfilling.
