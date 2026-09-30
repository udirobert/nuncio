# nuncio — OpenClaw SDR agent

Your startup's first sales hire: a disclosed AI twin that researches a
prospect, writes the first touch in your voice, sends it over email or text,
handles the replies, and books the meeting. Honest presence — the twin always
says what it is.

Built on the [Plow OpenClaw base image](https://github.com/plow-pbc/plow-openclaw-agent).
OpenClaw 2.0 multiplayer: the owner works with the agent in their DM while
prospects talk to it in untrusted group threads and email threads — anyone can
interface with it, only the owner can authorize.

The backend pipeline lives in the parent repo ([nuncio](https://github.com/udirobert/nuncio),
production: https://nuncio.persidian.com). Without a token the agent uses the
public, rate-limited `POST /api/agent/lite` (research + script, no render);
installs with `NUNCIO_AGENT_TOKEN` unlock the full pipeline: HeyGen video
renders (`nuncio-render`) and the owner-authorized text-to-live handoff
(`nuncio-followup`).

## Run it

```sh
plow-agents login            # text the printed activation phrase
plow-agents lines            # pick a free line id (ln_xxx)
plow-agents mint ln_xxx      # writes ./plow-credentials
docker compose up --build -d
# text the line's number — first message starts onboarding
```

Optional per-install overrides go in `plow-credentials`:

```
NUNCIO_AGENT_TOKEN=...       # unlocks render upgrade via full pipeline
```

## Text-to-live handoff

With `NUNCIO_AGENT_TOKEN` configured for a backend whose `NUNCIO_AGENT_WORKSPACE_ID`
binds that token to the owner's workspace (and `NUNCIO_API_URL` pointing at the
backend, default `https://nuncio.persidian.com`), nuncio-followup can mint
owner-authorized live invitations:

- `POST /api/agent/handoffs` — create a private invite URL (`#handoff=` bearer
  fragment, default 24h TTL, 1–168h bound) with a compact context summary;
  never send transcripts or contact data.
- `GET /api/agent/handoffs/<id>` — refresh twin/call/booking options before
  drafting the invitation message.
- `GET /api/agent/call-requests` — owner-turn inbox poll (pending requests +
  dashboard URL); pull only, no push.
- `DELETE /api/agent/handoffs/<id>` — revoke on explicit owner request; blocks
  future entry, does not end connected calls.

All calls are authorized-owner-turn only — see `skills/nuncio-followup/SKILL.md`
→ "Text-to-live handoff" for the exact procedure and honest-copy rules.

> Ships in `ghcr.io/udirobert/nuncio-openclaw:v3` — running lines still on `v2`
> need a redeploy to pick it up.
> There is no push-notification or phone API; progress is polled on authorized
> owner turns only. The agent's local `~/playbook.md` is NOT automatically
> synced — the owner's SenderPlaybook and booking URL must already be
> configured on the nuncio workspace for the twin to answer well and for
> booking to appear in `options`. Handoff storage on file (`NUNCIO_DATA_DIR`)
> is single-process only — a revoke that fails to persist stays denied in
> memory but is lost on restart and must be retried; use Turso in production.

Example create call:

```sh
curl -X POST "$NUNCIO_API_URL/api/agent/handoffs" \
  -H "Authorization: Bearer $NUNCIO_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientName": "Ria",
    "summary": "Asked about startup pricing after the demo thread.",
    "interests": ["pricing"],
    "unansweredQuestions": ["startup discount?"],
    "recommendedNextStep": "twin",
    "expiresInHours": 24
  }'
```

Response: `{handoffId, shareId, inviteUrl, expiresAt, options,
recommendedNextStep}` — `options` reflects live config (`twin`,
`callRequestsEnabled`, `acceptingCalls`, validated `bookingUrl`) and
`recommendedNextStep` is the requested step only if that option is actually
available, else the best available fallback or null. Never include
transcripts, phone numbers, emails, thread IDs, or credentials.

## Deploy

Published image: `ghcr.io/udirobert/nuncio-openclaw:v3`
(digest `sha256:13d104eb9a66d20bc17197d45220a62946eee57094865c3f151acc71b6539586`).
Verified on the Agent Index with 1-click deploy enabled.

```sh
# on a linux/amd64 host with docker
plow-agents image build ghcr.io/<you>/nuncio-agent:v1
plow-agents image push ghcr.io/<you>/nuncio-agent:v1   # then make the package public
plow-agents deploy ghcr.io/<you>/nuncio-agent@sha256:<digest> --line ln_xxx
```

`AGENT_ID=nuncio` is baked into the image: boot registers the listing on the
[Agent Index](https://aiworthusing.com/agent-index) and reports token usage
every 5 minutes.

## Layout

- `prompt/persona.md` → baked to `/opt/plow/prompt/AGENTS.md` (SDR persona +
  Plow trust rules)
- `skills/*/SKILL.md` — onboard, research, outreach, follow-up, render, report
- `Dockerfile` — variant on the pinned Plow base
- `compose.yml` + `dev/Caddyfile` — local run with dashboard on :3001

MIT licensed (see ../LICENSE).
