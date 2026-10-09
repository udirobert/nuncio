# ChatGPT plugin playbook (Oct 2026)

Grounded in [OpenAI Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines) and DevDay 2026 Plugin Extensions (skills + MCP + optional UI + MCP Events; universal ChatGPT/Codex directory at chatgpt.com/plugins).

## Why this window matters

ChatGPT can surface plugins mid-conversation when user intent matches a tool. That is the distribution bet: empty high-intent slots, description in the user's words, free action first, then double down on what gets recommended.

## Shared shipping rule (all our plugins)

1. **Trigger phrase** = exact words people type ("is my data healthy?", "audit this paper").
2. **Ship the free action first** — discovery + recommendation surface.
3. **Watch** which queries get recommended mid-conversation.
4. **Double down** on that slot (narrower tools, better examples, reliability).

## Best-in-class shape

| Layer | Do this |
| --- | --- |
| Capability | Headless MCP tools first; optional UI only where it changes the outcome (preview, confirm, compare). |
| Tools | Narrow, verb-named (`health_check`, `extract_claims`). Separate tools per operation — no generic executor. |
| Descriptions | When to use **and** when not. Match schema and real behavior. No "prefer this over X". |
| Annotations | Set `readOnlyHint`, `destructiveHint`, `openWorldHint` explicitly. |
| Listing | Clear name (not generic single word; don't append "Plugin"/"MCP"). Example **Prompts**, not screenshots. No pricing/trials/promos in the description. |
| Privacy | Published privacy policy; minimize inputs; no secrets/PCI/PHI in tool schemas. |
| Auth | Transparent OAuth; demo account with sample data for review. |
| Intent QA | Test direct, indirect, negative, ambiguous prompts. Track selection precision/recall, arg accuracy, completion, latency. |
| Business | Keep signup, billing, analytics on our site. ChatGPT = discovery + execution surface. |

## Monetization constraint (critical)

OpenAI currently allows plugin **commerce only for physical goods**. Selling digital products/services (subscriptions, credits, paid digital audits/briefings) **inside** ChatGPT is not allowed.

Allowed patterns for our free → paid ladders:

- Free tool runs fully in ChatGPT (the discovery wedge).
- User may **sign in to an existing paid account** and use entitlements already purchased elsewhere.
- Plugin may **explain** that a richer action needs a higher plan and link to an **informational** plans page — **not** to checkout.
- Do **not** initiate subscribe/upgrade/checkout in-plugin; do **not** apply ChatGPT-specific surcharges.
- Keep x402 / paid APIs on our own product URLs; treat ChatGPT as the free funnel + account-linked entitlements.

**Flagged, unresolved (product decision):** the MCP tool's `plansUrl` points at
`/pricing`, which today renders live Stripe checkout buttons. It is *used* as an
informational link (nothing is initiated inside ChatGPT), but it is not a
checkout-free page. Either add a non-checkout plans surface or accept this
deliberately before submitting — see `docs/CONNECT.md`.

## Launch checklist

- [x] One primary trigger phrase in user language
- [x] Free read-only (or low-side-effect) tool shipped and stable
- [x] Paid/deep action available via existing account or external product — not in-plugin checkout
- [ ] Intent test set (10+ prompts) with pass/fail — written in [EVAL.md](./EVAL.md), run it
- [x] Privacy policy + support contact ready (`/privacy`, `/support`; `NUNCIO_SUPPORT_EMAIL` must be set to a real address before submission) — identity verification / demo account still pending
- [ ] Example Prompts on the directory listing — copy ready in [STARTER_PROMPTS.md](./STARTER_PROMPTS.md)
- [ ] Measure recommendation rate → double down

## Scoreboard → events mapping

Server-side capture lives in `src/lib/analytics-server.ts` (PostHog, opt-in on
`NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`; distinct id = salted SHA-256 of client IP,
never the URL/brief/draft content):

| Scoreboard row | Event(s) | How to read |
| --- | --- | --- |
| 1 · Plugin connects | `mcp_connect` (props `method`: initialize / tools_list) | weekly count, by distinct id |
| 2 · Free tool calls / week | `mcp_tool_call` (props `tool`, `channel`, `demo`, `source`: rest / jsonrpc) | count with `demo = false` |
| 3 · Return users | both events | retention/doughnut insight: distinct ids with ≥2 events in 7d |

Caveats: `tools/call` proxies through the REST wedge, so each call is counted
exactly once (`source` marks the path); unidentifiable clients get one-off
`mcp-anon-*` ids and can never appear as "returning" — slight overcount of new
identities, zero false repeats. Set `NUNCIO_ANALYTICS_SALT` in prod.

Verified locally (2026-10-09) against a capture sink: `initialize` +
`tools/list` → exactly 2 `mcp_connect`; one JSON-RPC `tools/call` → exactly 1
`mcp_tool_call` with `source: "jsonrpc"` (no double count); direct REST demo →
`source: "rest"`. Props were `tool`/`channel`/`demo`/`source`/`method` only —
no URL, brief, or draft text. Not verified: the PostHog insights themselves and
the ChatGPT intent eval (user-owned, need prod env + a real ChatGPT account).

## Sources

- https://developers.openai.com/plugins/plugin-guidelines
- https://learn.chatgpt.com/docs/plugins
- DevDay 2026 Plugin Extensions / mid-conversation discovery writeups (e.g. intent routing / "plugin SEO")

## Usage-only scoreboard (Plugin Lane)

Watch weekly. **Usage-first; don't chase ARPU yet** — no paid conversion, checkout, or monetisation metrics on this board. Free MCP wedge in ChatGPT: `research_and_draft`; render / live link stay off-platform if mentioned at all and are out of scope here. Instrument when you have analytics (MCP/`/api/mcp` request logs, product referral/`utm`, stable client ids); do not invent dashboards until those exist.

| # | Metric | What “good” looks like |
| --- | --- | --- |
| 1 | Plugin connects | Successful connect + `tools/list` for `https://nuncio.persidian.com/api/mcp` |
| 2 | Free tool calls / week | Calls to live free tool: `research_and_draft` |
| 3 | Return users | ≥2 sessions in 7 days (same ChatGPT user / stable client id if logged) |

Related: [CONNECT](./CONNECT.md) · free wedge vs paid follow-up (not in-plugin) · [VIRAL-LOOP.md](./VIRAL-LOOP.md) for the on-site invite loop scoreboard.
