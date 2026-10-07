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

## Rate limits

`mcpResearchDraft`: 20 requests / IP / hour (same order as `/api/agent/lite`).

## ChatGPT directory checklist

See [CHATGPT_PLUGIN_PLAYBOOK.md](./CHATGPT_PLUGIN_PLAYBOOK.md). Listing needs privacy policy, support contact, example prompts ([STARTER_PROMPTS.md](./STARTER_PROMPTS.md)), and intent QA ([EVAL.md](./EVAL.md)).
