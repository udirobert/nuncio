# OpenClaw 2.0 First-Hire Hackathon — working doc

**Event:** AI Worth Using / AgentCribs — "build your startup's first hire with OpenClaw 2.0"
**Submission deadline:** Sep 29, 11:59pm PT (publish on the Agent Index)
**Leaderboard snapshot:** Sep 30, 11:59pm PT → top 5 go to judges (TPW + AgentCribs)
**Scoring:** valid users × their tokens (each capped 100M); valid user = 200k+ tokens, active ≤28d
**Requirements:** OpenClaw 2.0 multiplayer mode, MIT license, real startup use case, ≥60s demo video, usage reporting via the AI Worth Using client, verification via Discord

Positioning rationale lives in [`STRATEGY.md` → "Application: OpenClaw 2.0 first-hire hackathon"](./STRATEGY.md). Lead line: **an SDR that doesn't send outreach — it holds the first conversation.** Never lead with research; it's plumbing.

## Entry: `nuncio` — the conversational SDR twin

| Piece | Where |
|---|---|
| Agent variant image | `openclaw-agent/` (Dockerfile on pinned Plow base `base-771198a9` / `ghcr.io/openclaw/openclaw:2026.9.6`) |
| Persona | `openclaw-agent/prompt/persona.md` → baked to `/opt/plow/prompt/AGENTS.md` |
| Skills | `openclaw-agent/skills/` — onboard, research, outreach, follow-up, render, report |
| Public backend | `POST /api/agent/lite` — rate-limited (20/hr/IP) research+script, no auth, no render |
| Full pipeline | `POST /api/agent/prospect-queue` (token-gated; unlocks video/livelink render) |
| Usage reporting | automatic — `AGENT_ID=nuncio` baked into image |

## Mechanics notes (from plow-pbc/plow-openclaw-agent)

- Variant = `FROM <base>@<digest>` + `ENV AGENT_ID/AGENT_NAME/AGENT_BLURB` + `COPY prompt` + `COPY skills`.
- Boot auto-registers the Index listing and reports day×model tokens every 5 min (agentsview over the OpenClaw SQLite session store).
- Plow tools: `plow_start_thread` (groups, `trusted:false` for prospects — `PLOW_THREAD_TRUST=untrusted` baked), `plow_ask_owner` (escalation), `plow_reply_to` (cross-thread replies).
- Agent has its own phone line + email line; model is `z-ai/glm-5.2` via Plow with `claude-sonnet-5` fallback.
- `plow-agents` CLI: `login` (text activation phrase) → `lines` → `mint ln_xxx` (writes `plow-credentials`) → `docker compose up`.
- Cloud/1-click deploy: push public image to ghcr, post uid + slug + `repo@sha256:` digest in Discord; an admin enables 1-click once. Afterwards `image push --promote <slug>` ships updates.
- MIT: repo-wide `LICENSE` added at root (udirobert/nuncio is public).

## Status — submitted ✓

- **Listing:** https://aiworthusing.com/agent-index/nuncio — verified, 1-click deploy enabled, finished (video + screenshot + install link)
- **Live line:** +1 (650) 315-6335 (`ln_p2` / Aspen) — `ln_p1` was retired (outbound stuck at `sent`, never `delivered`; Plow-side)
- **Pinned image:** `ghcr.io/udirobert/nuncio-openclaw@sha256:4db774749a9b83759f536a6c15a53d3594a7173e957e084509dcc37d26f5e579` — includes post-test persona fixes
- **Demo video:** https://youtu.be/wwwtA8X1kNs (66s; `demo-video/` HyperFrames composition, cream/Instrument-Serif brand pass, lo-fi bed cut to an 80.7bpm grid)
- **Multiplayer proven end-to-end** (chat `cht_1pTh486INwln9r2Bd-CN1w`): onboarding → playbook → draft → owner approval → `plow_start_thread` group → prospect objections → `plow_ask_owner` escalation → owner answers in DM → `plow_reply_to` relay → booking link
- **Fixture:** `openclaw-agent/prospect-sim/` — skeptical-VP agent (Maya) for repeatable thread tests; parked at `/root/openclaw-prospect` on the Vultr box (`docker compose -p prospect up -d` revives)

### Persona fixes from the first live run (in v2 image)

- `NO_REPLY` sentinel for no-op turns — kills the "I'll stay silent" loop where every inbound message forced a reply
- Answer playbook-covered questions directly; escalate only missing facts / commitments / owner decisions
- Batch open questions into one concise `plow_ask_owner`, plain text
- Never leak chat UIDs, tool names, or internal state to prospects
- After a runtime error, verify thread history before claiming something was fabricated or sent

## Sequence

1. [x] MIT license at repo root
2. [x] `openclaw-agent/` scaffold (Dockerfile, persona, 6 skills, compose)
3. [x] `/api/agent/lite` endpoint (verified locally: URL → profile + script + review)
4. [x] Push to GitHub; lite endpoint live in production
5. [x] `plow-agents login` + line minted (`ln_p2`)
6. [x] Deployed on Vultr (amd64) → end-to-end text test incl. live multiplayer thread
7. [x] `image build` → `image push` (public ghcr) → listing registered (auto via AGENT_ID)
8. [x] Discord submission → **verified + 1-click deploy enabled** (passed: researched a real store, flagged profile mismatch, drafted disclosed twin email, asked before sending)
9. [x] 66s demo video rendered → on the listing via `image set --video`
10. [ ] Drive installs + usage before Sep 30 snapshot (valid user = 200k+ tokens, ≤28d active); post real-outcome stories via `nuncio-report`

## Deliberate choices

- **No credential in the image.** Public installs use `/api/agent/lite`; our installs set `NUNCIO_AGENT_TOKEN` in `plow-credentials` for the full pipeline incl. render. Never bake the token.
- **Token-burn by design:** conversational onboarding, in-chat draft iteration, follow-up threads — the 200k-token valid-user floor is a design constraint, not an afterthought.
- **Fallback inside skills:** if the backend is unreachable or over quota, the agent does a light in-chat research pass — public installs never hard-fail.
