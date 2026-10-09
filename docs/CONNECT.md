# Connect — ChatGPT / MCP (nuncio)

Trigger phrase: **"write my first message to this prospect"**

## Endpoints

| Surface | Method | Path |
| --- | --- | --- |
| Tool discovery | `GET` | `/api/mcp/tools` |
| Free wedge | `POST` | `/api/mcp/research-and-draft` |
| Thin MCP stub | `GET`/`POST` | `/api/mcp` (JSON-RPC `initialize` / `tools/list` / `tools/call`) |
| Equivalent public lite API | `POST` | `/api/agent/lite` (research + script only; no channel draft) |

Base URL (prod): `https://nuncio.persidian.com`  
Local: `http://localhost:3000` after `pnpm dev`

## Free tool — `research_and_draft`

```bash
curl -s -X POST http://localhost:3000/api/mcp/research-and-draft \
  -H 'content-type: application/json' \
  -d '{
    "url": "https://linkedin.com/in/example",
    "senderName": "Alex",
    "senderBrief": "We help SDRs book demos with personalized video first-touches.",
    "channel": "linkedin"
  }'
```

Demo / directory review (no live research):

```bash
curl -s -X POST http://localhost:3000/api/mcp/research-and-draft \
  -H 'content-type: application/json' \
  -d '{"demo": true, "url": "https://example.com"}'
```

JSON-RPC stub:

```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"research_and_draft","arguments":{"demo":true,"url":"https://example.com"}}}'
```

## Paid follow-up (not in-plugin)

Render and live avatar / livelink require an **existing nuncio account** or the informational plans page on the product site. Do **not** start subscribe/checkout inside ChatGPT (OpenAI allows plugin commerce for physical goods only).

- Product: https://nuncio.persidian.com  
- Plans (informational): https://nuncio.persidian.com/pricing  

## Privacy + support surfaces

`GET /api/mcp` advertises `privacyPolicyUrl` and `supportUrl` (derived from the
request origin, so they follow the deployed domain). Both pages exist:
`/privacy` (what is stored, what is deliberately not, third parties, salted
analytics ids, referral attribution, no in-plugin checkout, deletion) and
`/support` (address from `NUNCIO_SUPPORT_EMAIL`; placeholder text until that env
var is set). Both are linked from the site footer.

## Telemetry

`initialize` / `tools/list` emit `mcp_connect` and each accepted call emits
`mcp_tool_call` (`source` = `rest` or `jsonrpc` — the JSON-RPC stub proxies to
the REST wedge, which is the single instrumentation point). Capture is opt-in on
`NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`; distinct id is a salted SHA-256 of the
client id. Props are usage-only: never the prospect URL, sender brief, or
drafted text. See `docs/CHATGPT_PLUGIN_PLAYBOOK.md` → Scoreboard mapping.

## Rate limits

`mcpResearchDraft`: 20 requests / IP / hour (same order as `/api/agent/lite`).

## ChatGPT directory checklist

See [CHATGPT_PLUGIN_PLAYBOOK.md](./CHATGPT_PLUGIN_PLAYBOOK.md). Privacy policy
and support contact are shipped; example prompts live in
[STARTER_PROMPTS.md](./STARTER_PROMPTS.md); intent QA is [EVAL.md](./EVAL.md)
(not yet run — user-owned).

**Open before submission:** `/pricing` currently renders live Stripe checkout
buttons, while the guidelines say the plugin should lead to an *informational*
plans surface (with the account as the paid path). Either point `PLANS_URL` at a
non-checkout page (`src/app/api/mcp/research-and-draft/route.ts`, hardcoded
alongside `PRODUCT_URL`) or accept the current page deliberately — product
decision, see `docs/CHATGPT_PLUGIN_PLAYBOOK.md`.
