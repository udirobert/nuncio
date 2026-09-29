---
name: nuncio-research
description: Research a prospect and draft the outreach script — calls the nuncio backend (full pipeline when NUNCIO_AGENT_TOKEN is set, else the public /api/agent/lite endpoint, else in-chat fetch fallback). Use whenever the owner gives a prospect URL or asks to research someone.
---

# Prospect research

Produces a prospect profile + a script draft. Three paths, in priority order.

## Path 1 — full pipeline (NUNCIO_AGENT_TOKEN set)

    BASE="${NUNCIO_API_URL:-https://nuncio.persidian.com}"
    cat > /tmp/nuncio-req.json <<'EOF'
    {
      "url": "<prospect URL>",
      "senderName": "<from ~/playbook.md>",
      "senderBrief": "<one-paragraph brief: who owner is + why reaching out>",
      "senderBusiness": "<company>", "senderOffer": "<offer>",
      "outreachGoal": "<the ask>", "desiredOutcome": "<e.g. 15-min intro call>",
      "wants": "...", "canOffer": "...", "wiggleRoom": "...",
      "constraints": ["...", "..."],
      "tonePreference": "<from playbook>",
      "autoRender": false
    }
    EOF
    curl -sS --max-time 30 -X POST "$BASE/api/agent/prospect-queue" \
      -H "Authorization: Bearer $NUNCIO_AGENT_TOKEN" \
      -H "Content-Type: application/json" -d @/tmp/nuncio-req.json

Returns `{"queueId":"..."}`. Poll until `status` is `completed` or `failed`
(every ~15s, up to ~8 min):

    curl -sS "$BASE/api/agent/prospect-queue?id=<queueId>" \
      -H "Authorization: Bearer $NUNCIO_AGENT_TOKEN"

`result.profile`, `result.script`, `result.researchQuality.confidence`.
If `researchQuality.confidence` is `low`, tell the owner the data was thin —
never pretend otherwise.

## Path 2 — public lite endpoint (no token)

Same JSON body (autoRender ignored), synchronous, ~1–2 min:

    curl -sS --max-time 240 -X POST "$BASE/api/agent/lite" \
      -H "Content-Type: application/json" -d @/tmp/nuncio-req.json

Returns `{profile, script, review, researchQuality}` directly. On 429, wait
`Retry-After` seconds and retry once; if still limited, fall to path 3.

## Path 3 — in-chat fallback (endpoint unreachable or over quota)

`curl -sL --max-time 30` the prospect URL, skim the HTML/text yourself, and
build a light profile (name, role, company, one or two specifics worth
referencing). Tell the owner this is a light pass.

## After research

- Save the result: `mkdir -p ~/prospects` then write
  `~/prospects/<slug>.md` — profile summary, script draft, status.
- Report to the owner in a few lines: who this person is, the one thing that
  makes outreach timely, then the drafted first-touch text for approval.
- Draft the opener in the owner's voice per ~/playbook.md — short, specific,
  one ask. The backend script is material, not gospel: tighten it to a text/
  email-length opener.
