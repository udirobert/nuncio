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

## Sequence

1. [x] MIT license at repo root
2. [x] `openclaw-agent/` scaffold (Dockerfile, persona, 6 skills, compose)
3. [x] `/api/agent/lite` endpoint (verified locally: URL → profile + script + review)
4. [ ] Push to GitHub; deploy lite endpoint to production (`scripts/deploy-vps.sh`)
5. [ ] `plow-agents login` + mint a line (user: needs their phone for activation text)
6. [ ] `docker compose up` on Vultr box (amd64 — skip Mac, base is amd64) → text test end-to-end
7. [ ] `image build` → `image push` (public ghcr) → register listing (auto via AGENT_ID)
8. [ ] Discord: post uid + slug + digest → verification + 1-click deploy
9. [ ] ≥60s demo video — judge-as-prospect format
10. [ ] Drive installs + usage; post real-outcome stories via `nuncio-report`

## Deliberate choices

- **No credential in the image.** Public installs use `/api/agent/lite`; our installs set `NUNCIO_AGENT_TOKEN` in `plow-credentials` for the full pipeline incl. render. Never bake the token.
- **Token-burn by design:** conversational onboarding, in-chat draft iteration, follow-up threads — the 200k-token valid-user floor is a design constraint, not an afterthought.
- **Fallback inside skills:** if the backend is unreachable or over quota, the agent does a light in-chat research pass — public installs never hard-fail.
