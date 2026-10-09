# Viral loop teardown + K-factor worksheet (STRATEGY S6)

Note origin: README "Virality (Nikita Bier playbook)" — run the invite-flow
teardown, fill the worksheet, run the 48-hour share-CTA copy test, then the
ladder check. Strategy lives in `docs/STRATEGY.md`; this doc is the measurement
teardown only.

## Invite flow (as built)

1. Recipient opens `/v/[id]` (or `/live/[id]`).
2. Recipient clicks the recipient→sender CTA: `/?ref=share-{id}-cta{a|b}` (main
   card), `/?ref=share-{id}-header-cta{a|b}` (header) or `/?ref=live-{id}`
   (live footer) → event `viral_cta_clicked`.
3. Landing reads `?ref=` once → event `viral_landing`, and stores the ref in
   localStorage (`nuncio_ref`, first-touch wins, 30-day expiry).
4. Recipient becomes a sender — `signed_up` (server, new accounts only,
   distinct id = email) fires wherever the account is created: magic-link
   verify, the studio email gate, or a Stripe checkout webhook.
5. First authenticated dashboard load → `posthog.identify(email)` (merges the
   anonymous landing person, best-effort — same browser only) and
   `POST /api/account/attribution` → `referredBy` persisted on
   `WorkspaceAccount` + event `referred_signup`; localStorage ref cleared.
6. New sender creates their first touch → activation. If they share it, the
   loop repeats.

Ground truth for "this signup came from that invite" is `referredBy` in our own
storage — the PostHog anon→email merge is convenience, not proof.

## Funnel table (fill from PostHog weekly)

| Stage | Event / source | Count | Conversion vs previous |
| --- | --- | --- | --- |
| Share page opens (impressions) | `video_watch_through` (approx; page-open event not yet instrumented) | | — |
| Invite clicked | `viral_cta_clicked` (props: shareId, ref, surface) | | / impressions |
| Landed with ref | `viral_landing` (props: ref, mode) | | / clicks |
| Signed up | `signed_up` (server) | | / landings |
| Attributed signup | `referred_signup` / `WorkspaceAccount.referredBy` | | / signups |
| Activated (first touch created) | first `form_submitted` on that workspace | | / attributed signups |
| Re-shared (loop closes) | `video_shared`, or a `viral_cta_clicked` on their share | | / activations |

**K (viral coefficient)** = attributed activations per activated sender ×
invite-to-signup conversion. Rough form:
`K = (referred_signup count / activated senders) × (signed_up / viral_landing)`.

**Cycle time** = median days from `signed_up` to that workspace's first
`video_shared`. Under a week = fast loop; over a month = the loop is really
word-of-mouth, not compounding.

Worksheet period: ______ → ______

Current readings (first week after instrumentation): K unknown — the
converted rung was previously unmeasurable; this doc's steps 4–5 close that
gap. Do not compute K from pre-instrumentation data.

## 48-hour share-CTA copy test

Split is deterministic per share (`ctaVariant(shareId)`), variants ride the
ref suffix — read the breakdown by `ref` LIKE `%ctaa` / `%ctab` on
`viral_cta_clicked` and `viral_landing`:

| Variant | Headline | Button | Footnote |
| --- | --- | --- | --- |
| A (control) | This researched you, wrote what you just watched, and can answer questions live. | Make yours → | It's {Name}'s AI twin — disclosed up front… |
| B | Your name landed in the wrong inbox — so a twin researched you, wrote what you just watched, and can answer questions live. | Make yours → | It's disclosed AI, guided by their playbook — not a disguised blast. Free · 90 seconds. |

Caveats, stated honestly:
- The unit of split is the **share**, not the viewer — one recipient's click
  and another's on the same link always see the same copy.
- Both share-page CTAs (main card and header) carry the variant suffix; the
  header's copy is unchanged by the test, so read its clicks as *reach*, not
  as a copy response. Breakdown by `ref` suffix: `%ctaa` / `%ctab`, optionally
  split further on `-header`.
- Reconnect mode and the live-page footer carry no variant — they fall outside
  this test.
- Expired/not-found share pages link home with **no ref at all** — those clicks
  are unattributable by design (no share to attribute to).
- 48 hours at current traffic is **directional, not statistically
  significant**. Decide on the click→landing ratio trend, not a single winner.

## Verification status

Checked locally (2026-10-09) against a capture sink on a throwaway file-provider
dev server: `POST /api/account/session` → `signed_up` (distinct id = email);
`POST /api/account/attribution` → `referred_signup` + `referredBy` persisted on
the workspace; a second ref → `{"attributed":false}` with **no** second event
(first touch is immutable); a URL-shaped ref → 400 and an unauthenticated call
→ 401, each emitting nothing. Ref storage was verified in a real browser
(`nuncio_ref` on `/?ref=…`). Not verified: prod PostHog (needs
`NUNCIO_ANALYTICS_SALT` + the real project token), the anon→email `identify`
merge across a real funnel, and the copy test itself — which needs traffic.

## Ladder check

- **Core flow proven?** Yes — research → script → live link/first touch works
  end-to-end (Phase 1 ✅, OpenClaw submission verified).
- **First unproven rung: spreads.** No data has ever shown a recipient
  clicking "Make yours →" and signing up (converted was unmeasurable until
  this change).
- Per the note: **stop work above it.** No referral rewards, no leaderboard,
  no referral UI, no paid acquisition feeding the loop — until `spreads` is
  measured. Falsification: if after ≥4 weeks of real share traffic K < 0.1 and
  attributed signups ≈ 0, the recipient→sender loop is not the growth channel
  and STRATEGY's S6 bet needs revisiting.

## Known gaps (deliberately not built)

- No share-page impression event distinct from watch-through.
- `signed_up` fires when an account row is **created**, so a magic link that is
  requested but never clicked counts as no signup — while the studio email gate
  counts immediately, before any link is confirmed. Treat email-gate signups as
  softer than verified ones.
- Attribution is first-touch only; a second ref before dashboard load is
  ignored.
