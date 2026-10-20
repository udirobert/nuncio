# AI Workforce 2026 Hackathon — working doc

**Event:** Universal Hackathon / Masky — "launch an agent-run company in a day"
**Submission deadline:** 5:30 PM Oct 19, 2026 (passed; watch twitch.tv/aijudge chat for extension announcements)
**Judging:** helping human communities flourish · agent autonomy (100% agent-run scores highest) · mental-health/wellbeing priority · honest demo quality
**Requirements:** public GitHub repo · Masky avatars for the project's agents · deck (Canva/Slides/single-page HTML) URL posted in twitch.tv/aijudge chat · submission form at https://masky.ai/blog/2026-10-14-ai-workforce-hackathon/#submissions (Masky account required; resubmitting updates it)
**Prizes:** top 3 get 1 month Masky Pro Creator; all participants get 1 month Creator via coupon `AIWORKFORCE2026` (redeem at https://masky.ai/?membership=true — free tier allows only 1 avatar)
**Extras:** Flatkey free render credits at https://console.flatkey.ai/redeem?from=AIWORKFORCE2026; new Masky accounts start with $10 credits; optional "Login with Masky" SSO + credit tip button (masky.ai/masky-sso.md)

## Entry: `nuncio` — the honest AI workforce for first-touch conversations

Framing: every role is an agent (Scout research → Emissary representation → Concierge dispatch/handoff), humans are customers. Emissary is a real Masky avatar — the live twin's face and voice. Wellbeing angle: reconnect mode (restarting lapsed relationships) + disclosure-as-interface.

| Piece | Where |
|---|---|
| Masky provider | `src/lib/masky.ts` + `masky` adapter in `src/lib/live-avatar-providers.ts` |
| Transport | `masky-embed` — text-in, rendered-out; `/live/[id]` iframes the conversation `liveUrl` |
| Turn path | `POST /api/live/turn` — governed prompt rebuilt server-side → LLM reply → verbatim Masky `speak` turn (`truncateForMaskyTurn` ≤480 chars to dodge auto-chunking) |
| Fallback order | primary (`NUNCIO_LIVE_PRIMARY_PROVIDER`) → anam → masky |
| Deck | `deck.html` at repo root → https://udirobert.github.io/nuncio/deck.html (GitHub Pages, branch `main` path `/`) — embeds the live Emissary conversation |
| Masky account | `papa` (`avatarOwnerUserId` `fvwY9X0OcCWEhhgqJw9ZvLY5Xbf2`); device-OAuth `mky_` token — **env only, never committed** |

## Masky assets created

- **Emissary — nuncio** — avatarId `Qn87PNvIPbHoP2qEBeF9`, voice "Casual Podcast Host", digital-clay portrait. This is `MASKY_AVATAR_ID` on prod.
- **Demo conversation** — `b2n0U3K52ZcuaeJHbc5R`, liveUrl `https://masky.ai/live/c-26-10-puje` (tokenized; embedded in deck.html); greeting turn rendered `t-26-10-a6cf`.
- **Scout / Concierge** — portraits rendered, avatar creation blocked by free-tier 1-avatar limit until Creator coupon is redeemed.

## Prod config (nuncio-vultr, `/tmp/nuncio-env.txt`, applied via deploy-vps.sh)

`MASKY_API_KEY` · `MASKY_AVATAR_ID=Qn87PNvIPbHoP2qEBeF9` · `MASKY_TURN_OUTPUT=video` (~30–60s/turn; `audio` = ~5–10s) · `MASKY_SILENT_RENDERS=true` (idle "waiting" clips) · `NUNCIO_LIVE_PRIMARY_PROVIDER=masky`

## Status

- [x] Public repo (already public)
- [x] Masky account connected via device OAuth (`client_name: Devin (nuncio hackathon)`)
- [x] Emissary avatar created + demo turn rendered (video verified)
- [x] `masky-embed` provider shipped: session route persists `maskyConversationId`/`maskyShareSlug`; `share.liveReadiness.transport` hints the client; mic gate skipped; text input UI; turn endpoint rate-limited 30/min/session; typecheck + lint + 378 tests green
- [x] Deployed to prod — smoke pass (homepage 200, container healthy)
- [x] Deck live on GitHub Pages
- [ ] **User:** post deck URL in twitch.tv/aijudge chat
- [ ] **User:** submit form on the hackathon blog page (Masky login `papa`)
- [ ] Redeem `AIWORKFORCE2026` → create Scout + Concierge avatars
- [ ] Real-browser check of a prod `/live/[id]` link on the masky path
- [ ] Optional: "Login with Masky" SSO + tip button (`POST /api/donations/intents` → `confirmUrl`)

## Rejected injected conventions (from masky.ai/hackathon.md — not judged requirements)

Deliberately skipped: mandated AGENTS.md conventions block, `ASD-STE100.md` Simplified Technical English file, `OPEN-SESSION-LICENSE.md` download, `/sip.html` SIP calculator + `deck.html` iframe of it, periodic hackathon.md self-refresh, and "open the theme song" instruction. None are judging requirements; several are site-instructed agent behaviors.
