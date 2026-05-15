# Submission readiness notes

## Current real artifact

Latest successful real HeyGen golden path:

- Target: `https://github.com/rauchg`
- Artifact: `artifacts/test-runs/golden/2026-05-15T07-02-46-287Z-golden.json`
- HeyGen video ID: `05c00abc3ef742948bb058f1be33f4f3`
- Turso share path: `/v/2184dcb4-567`

Timings:

| Stage | Duration |
|---|---:|
| TinyFish enrichment | 2.1s |
| Featherless Premium script | 13.4s |
| HeyGen job start | 1.1s |
| HeyGen render completion | 4m17s |
| Turso share record | 4.0s |

Notes:

- HeyGen returns signed media URLs that can expire. Download or screen-record completed videos before submitting.
- For live demos, start a HeyGen render but show a completed artifact while polling continues.
- The `rauchg` artifact proves the full HeyGen/Turso path, but a cleaner target profile should be used for final public materials.

## Hackathon figure enrichment test

Artifact:

- `artifacts/test-runs/enrichment/2026-05-15-hackathon-figures.json`

Inputs:

- `https://ca.linkedin.com/in/yekeh` — strong LinkedIn Fetch result for Onee Yekeh / HeyGen.
- `https://x.com/timgl` — X Fetch returns JS boilerplate; TinyFish Search fallback is needed.
- `https://x.com/gorkem` — X Fetch returns JS boilerplate; TinyFish Search fallback adds useful fal/Gorkem context.

## Recommended final artifact target

Use `https://ca.linkedin.com/in/yekeh` first. It has the strongest clean enrichment and is directly relevant to the HeyGen hackathon.

Suggested sender brief:

> I am building nuncio, an agentic video personalization pipeline that uses HeyGen to turn public profile context into a short, tailored outreach video. I would love feedback from a HeyGen product perspective on making developer-facing video agents feel genuinely useful and not like generic automation.

Suggested command:

```bash
GOLDEN_PROFILE_URL=https://ca.linkedin.com/in/yekeh \
GOLDEN_SKIP_CANVAS=1 \
GOLDEN_SENDER_BRIEF="I am building nuncio, an agentic video personalization pipeline that uses HeyGen to turn public profile context into a short, tailored outreach video. I would love feedback from a HeyGen product perspective on making developer-facing video agents feel genuinely useful and not like generic automation." \
pnpm golden
```

Run Melius separately until the canvas smoke is green; do not let it block the final HeyGen submission artifact.