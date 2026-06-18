# Hackathon submissions

VidCard is being submitted to four simultaneous hackathons. The core product is identical across all four. What changes per submission is the framing, the judging criteria being addressed, and which parts of the stack to emphasise in the pitch.

---

## HeyGen Hackathon

**Dates:** May 14 (Build Day) · May 15 (Demo Day)
**Format:** Hybrid — HeyGen SF office + virtual
**Submission deadline:** May 15, 10:00 AM
**Demo:** May 15, 2:00–4:30 PM (live)
**Prize pool:** $3,000 Grand Prize · $1,000 Best Product · $1,000 Best AI Agent

### Angle
This is the primary submission. Lead with the technology stack — every major HeyGen tool is used in a coherent product, not just a feature demo.

### Tools used
- HyperFrames — scene composition and layout
- Video Agent — orchestrates the video creation session
- Avatar IV (demo day) + Avatar V (once live May 18)
- Voice Clone — sender's voice, pre-cloned
- Video Translate + Lipsync — multilingual output
- Image-to-Video — profile photo → animated background asset
- HeyGen API v3 (`/v3/videos`) — programmatic video creation

### Judging emphasis
- **Creativity:** personalisation using real enriched data, not templates
- **Technical depth:** full API integration across 5+ HeyGen products
- **Demo moment:** audience member gives their Twitter handle, video plays in ~5 minutes with their name and real context

### Demo script (5 minutes)
1. Ask an audience member for their Twitter/X handle and LinkedIn URL
2. Paste into VidCard, hit generate
3. While it processes (~4-5 minutes), show the agent trace: sources fetched, hooks chosen, tone selected, Melius canvas created
4. Review the script with highlighted personalization hooks
5. Render or open the completed HeyGen video — it references their actual work
6. Show the branded `/v/[id]` share page and Melius canvas proof
7. Show the translation option — switch to Spanish in one click if API credits allow

### Pitch one-liner
> "Drop any social profile. Get a personalised video in ~5 minutes. Built on every HeyGen tool in the stack."

---

## Milan AI Week — AI Agent Olympics

**Platform:** lablab.ai
**Dates:** May 13–20 2026 (online build phase) · May 19 (onsite build day) · May 20 (demo + awards, Fiera Milano)
**Prize pool:** $32,000+
**Ticket:** Free Milan AI Week conference ticket included for participants

### Angle
Position VidCard as an enterprise-grade autonomous agent, not just a creative tool. The agentic workflow is the story — a pipeline that reasons about context, makes decisions, and delivers a polished output with zero human intervention between input and video.

### Judging criteria alignment

| Criterion | How VidCard addresses it |
|---|---|
| Intelligent reasoning | Claude synthesises cross-platform context and makes script decisions without prompting |
| Agentic workflows | Multi-step pipeline: enrich → synthesise → compose → render → deliver. Each step calls external tools autonomously |
| Enterprise utility | Solves a real friction point: personalised outreach at scale is a $10B+ sales problem |
| Multimodal intelligence | Text (profiles) → structured JSON → script → visual assets → video + audio |

### Emphasis for this submission
- The Melius MCP integration — show the agent creating and managing a canvas autonomously
- The TinyFish parallel enrichment — highlight multi-platform context fusion
- Real-world enterprise use case framing (sales, recruiting, investor relations)
- Production-readiness signals: error handling, webhook support, retry logic

### Pitch one-liner
> "An autonomous agentic pipeline that turns any social profile into a personalised video pitch — from enrichment to rendered video, zero human steps."

### Vultr track (bonus)
Deploy the Next.js app on Vultr for the Vultr Award eligibility ($200 credits available). Document deployment steps in a `DEPLOY.md`.

---

## TechEx — Intelligent Enterprise Solutions

**Platform:** lablab.ai
**Focus:** Enterprise AI solutions — operations, sales, marketing, HR, customer support

### Angle
Frame VidCard as a B2B sales acceleration tool. The enterprise buyer is a VP of Sales or Head of Growth who wants to increase reply rates on cold outreach. Personalised video is the wedge — studies show 3–5x higher reply rates vs text email.

### Emphasis for this submission
- ROI framing: if a rep sends 50 personalised videos per week instead of 500 generic emails, what's the conversion improvement?
- CRM integration potential (HubSpot, Salesforce) — position as Phase 2 roadmap
- Team use case: multiple reps, shared avatar + voice, centralised Melius canvas per account
- Data hygiene: VidCard never stores the target's personal data beyond the session

### Judging criteria alignment

| Criterion | How VidCard addresses it |
|---|---|
| Multi-step agentic workflows | Full pipeline from URL to video with no human steps |
| Realistic future-of-work use case | Sales personalisation at scale is an active enterprise pain point |
| Production-style web application | Next.js, typed API routes, error handling, async video delivery |

### Pitch one-liner
> "Sales personalisation at scale — every rep sends a video that sounds like they wrote it specifically for that prospect, because the agent did."

---

## Melius Challenge

**Platform:** Contra
**Submission:** via `#meliuschallenge` topic

### What Melius is
Melius is an AI creative canvas with a full MCP server. It exposes tools for creating projects, canvases, and nodes; generating images and videos; and downloading all outputs as ZIP. nuncio uses the Melius MCP as its creative persistence and asset management layer.

### Current integration
The existing pipeline calls Melius programmatically in a headless step (see `src/lib/creative/melius-provider.ts`). It creates a project per target, drops text + image nodes, runs generations, and downloads assets for HeyGen. The canvas is invisible to the end user.

This is insufficient for the Melius hackathon on its own — the canvas needs to be a visible, interactive surface.

### Verified technical capabilities (from Melius docs)
All of the following are confirmed available via the Melius MCP:

| Capability | Confirmed |
|---|---|
| Embedded canvas previews (iframe, live state) | ✅ docs.melius.com/collaboration/sharing |
| `node_update` + `run_start` for iteration | ✅ docs.melius.com/mcp/tools |
| Canvas multiplayer presence | ✅ `show_presence` / `release_presence` tools |
| Edge wiring between nodes | ✅ `edge_create` / `bulk_create_edges` |
| 7 node types (text, image, video, audio, file, custom_text, group) | ✅ docs.melius.com/canvas/nodes |
| `canvas_content` to read back live state | ✅ docs.melius.com/mcp/tools |
| `display_canvas` inline preview | ✅ docs.melius.com/mcp/tools |

### Proposed `/studio` page

A standalone page at `/studio` where Melius is the star:

1. **Agent builds the canvas live** — paste a profile URL, watch nodes appear one by one (profile → script → visual direction → background → thumbnail). Each node tooltip shows the agent's reasoning.

2. **Embedded canvas preview** — the Melius canvas renders in an iframe via their share-link embed. User sees the live canvas state as the agent builds it.

3. **Iterate mode** — after the initial build, surface editable prompt fields for each image node. "Regenerate background warmer." Calls `node_update` + `run_start` via MCP, creates a new version.

4. **Edge wiring** — wire text nodes → image nodes so the image prompt includes the profile summary as context. Demonstrates data flow.

5. **Multi-node-type showcase** — use `custom_text` (script, profile), `image` (background, thumbnail), `group` (section container), and optionally `video` or `audio` nodes. Hits the ">1 node type" requirement.

6. **Canvas-as-deliverable** — the canvas itself IS the output. Position it as a repeatable creative template the user can fork and adapt for different prospects. HeyGen rendering is optional.

### Melius MCP tools used (expanded)

| Tool | Usage |
|---|---|
| `get_guide("getting-started")` | Mandatory first call — initialise agent context |
| `project_create` | New project per target person |
| `canvas_create` | Session canvas |
| `canvas_plan_layout` | Auto-layout nodes without overlaps |
| `bulk_create_nodes` | Script, profile summary, visual direction, background prompt, thumbnail prompt |
| `bulk_create_edges` | Wire text nodes → image nodes for prompt context |
| `node_update` | Edit image prompts during iterate mode |
| `run_start` | Single-node re-generation after prompt edits |
| `bulk_run_start` | Initial generation run on all image nodes |
| `bulk_run_wait` | Poll until all runs complete |
| `bulk_run_download` | Pull generated assets |
| `display_canvas` | Inline preview in the MCP agent chat (bonus demo moment) |
| `show_presence` / `release_presence` | Claim canvas region before mutations |
| `comment_create` | Log pipeline decisions as audit trail |
| `creative_download` | Export full canvas as ZIP |

### Emphasis for this submission
- Melius is visible and interactive, not a backend step
- The agent's decision-making is surfaced at every node
- Multiple node types are used and wired together
- The canvas is a reusable, forkable template — not ephemeral
- Iteration loop: user edits a prompt → agent re-runs → new version appears

### The differentiator — the Hook Engine

Outreach video as a format is stale, and judges scoring *Creativity & Uniqueness* will see prettier visual outputs from other submissions. To break out of "Melius wrapper" status, we are shipping the **Hook Engine**: the agent picks a *visual hook archetype* per recipient (Mirror / Origin / Future-cast / Inside joke / Day-in-the-life), generates a 3-second cinematic opener with fal or Runway, and composes a different node graph on Melius per archetype.

This:
- Adds the `video` node type, lifting us from 3 → 5+ node types in use
- Lets the agent decide the *output format* (9:16 vs 16:9, captions, length) based on recipient signals
- Makes each canvas visibly different, so the screenshots tell a different story per profile
- Reframes nuncio from "automation" to "a new media format"

Full design and implementation plan: [`docs/HOOK_ENGINE.md`](./HOOK_ENGINE.md).

### Pitch one-liner
> "nuncio's agent reads a profile, picks the right visual hook archetype for that person, then composes a Melius canvas where the hook is generated as cinematic video alongside the script — every node, edge, format, and creative decision made autonomously and visibly. The canvas isn't just where the work lives. It's how the agent thinks."

---

## Band of Agents Hackathon

**Dates:** June 12–19, 2026
**Format:** Online build phase
**Submission deadline:** June 19, 2026
**Prize pool:** $10,000+
**Track:** Track 1: Internal Enterprise Workflows
**Status:** Implementation complete — pending Band credentials and end-to-end test

### Angle
Position nuncio as a collaborative sales outreach production workspace. Transition the sequential processing pipeline into a shared Band Room where multiple specialized agents (Researcher, Copywriter, QA Compliance, and Producer) coordinate and communicate to deliver the final high-quality personalized pitch assets.

### Implementation Status
- [x] Python project initialized (`agents/` subproject with `uv` + `band-sdk` + `httpx`)
- [x] Researcher Agent — calls `/api/enrich`, posts structured enrichment to room
- [x] Copywriter Agent — listens for enrichment events, calls `/api/script`, posts draft
- [x] Reviewer Agent — validates script (word count, compliance, personalization), approves or requests edits
- [x] Producer Agent — listens for approval, calls `/api/video`, polls `/api/video/[id]` until complete
- [x] Main entrypoint — starts all 4 agents concurrently via `asyncio.gather`
- [x] Activity bridge — agents post structured events to Next.js for real-time studio UI
- [x] Collaborative session panel — live agent activity feed in studio UI with pipeline progress
- [x] SSE event stream — `/api/band/activity` bridges Python agents to browser
- [x] Band room creation API — `/api/band/room` creates room, adds agents, posts kickoff via Band REST
- [x] Studio integration — `startBandSession()` creates Band room and opens it in new tab
- [x] Production server wiring — spawns Band agents as child process when `BAND_ENABLED=true`
- [x] Config templates (`agent_config.yaml.example`, `.env.example`)
- [x] Root `package.json` script: `pnpm band-agents`
- [ ] Create 4 remote agents on app.band.ai platform
- [ ] Add credentials to `agents/.env` and root `.env`
- [ ] End-to-end test with a real Band room
- [ ] Demo video recording
- [ ] Submit to lablab.ai

### Integration Details
For the detailed technical architecture, sequence diagrams, directory structure, and task checklist, see the implementation specification at [`docs/BAND_INTEGRATION.md`](./BAND_INTEGRATION.md).

### Key Integrations
- Band Rooms: Collaborative state management and human-in-the-loop validation
- Band Agent SDK: Wraps the core scraping, writing, editing, and rendering modules
- Production Server: Combined Next.js, Speech Engine, and Band websocket agents under `src/server/production.ts`

### Pitch one-liner
> "nuncio shifts sales personalization from a black-box pipeline to a collaborative Band Room where specialized agents research, write, audit, and render your outreach video under direct human oversight."

---

## Cross-submission notes

### What stays consistent
- The core product and pipeline
- The tech stack
- The demo (same live demo works for all four)
- The GitHub repo (one repo, submitted to all four)

### What changes per submission
- The pitch one-liner and framing
- Which part of the stack to demo first
- The judging criteria language in the write-up
- The "enterprise use case" emphasis (heavier for TechEx/Milan, lighter for Melius)

### Submission checklist (per hackathon)
- [ ] Working prototype accessible online
- [ ] Demo video (2–3 minutes) — same video works for all four with minor intro edit
- [ ] Pitch deck / write-up tailored to judging criteria
- [ ] GitHub repo link (MIT licensed, open source)
- [ ] Team details

### Current implementation receipts
- [x] Demo mode (`?demo=true`) runs the full UI flow without external API keys
- [x] Agent trace is visible in script review and final video states
- [x] Canvas proof shows provider, asset count, and Melius canvas URL when available
- [x] Generated videos can create branded `/v/[id]` share pages via a file-backed MVP store
- [x] Storage abstraction supports Turso for durable share metadata and Grove for public redacted proof bundles
- [x] HeyGen wrapper tries Video Agent first and falls back to direct `/v3/videos`
- [x] Optional Fal image generation fallback is available when Melius is not configured
- [ ] Configure Turso credentials before Vultr deployment for production-like share durability
- [ ] One real golden-path HeyGen + Melius render should be recorded before each submission

### Demo video script (shared across all submissions)
1. **0:00–0:20** — Problem: cold outreach has a <5% reply rate. Personalisation helps but doesn't scale.
2. **0:20–0:40** — Solution: VidCard. Drop a social profile, get a video.
3. **0:40–1:30** — Live demo of the pipeline end-to-end
4. **1:30–1:50** — Show Melius canvas with organised assets
5. **1:50–2:10** — Show the video output, copy the link
6. **2:10–2:30** — Roadmap: batch mode, CRM integrations, multilingual