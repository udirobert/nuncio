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
- **Demo moment:** audience member gives their Twitter handle, video plays in 60 seconds with their name and real context

### Demo script (2 minutes)
1. Ask an audience member for their Twitter/X handle and LinkedIn URL
2. Paste into VidCard, hit generate
3. While it processes (~90s), show the agent trace: sources fetched, hooks chosen, tone selected, Melius canvas created
4. Review the script with highlighted personalization hooks
5. Render or open the completed HeyGen video — it references their actual work
6. Show the branded `/v/[id]` share page and Melius canvas proof
7. Show the translation option — switch to Spanish in one click if API credits allow

### Pitch one-liner
> "Drop any social profile. Get a personalised video in 60 seconds. Built on every HeyGen tool in the stack."

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
Melius is an AI creative canvas with a full MCP server. It exposes tools for creating projects, canvases, and nodes; generating images and videos; and downloading all outputs as ZIP. VidCard uses the Melius MCP as its creative persistence and asset management layer.

### Angle
Position VidCard as a native Melius use case — an agent that drives Melius autonomously to produce a complete creative deliverable. The pitch is: "this is what Melius is for."

### Melius MCP tools used in VidCard

| Tool | Usage |
|---|---|
| `project_create` | New project per target person |
| `canvas_create` | Session canvas |
| `canvas_plan_layout` | Auto-layout nodes without overlaps |
| `bulk_create_nodes` | Script, profile summary, background prompt, thumbnail prompt |
| `bulk_run_start` | Trigger image/video generation on all nodes simultaneously |
| `bulk_run_wait` | Poll until all assets are ready |
| `bulk_run_download` | Pull generated assets for HeyGen |
| `creative_download` | Export full canvas as ZIP |
| `get_guide("ugc-ads")` | Inform node structure for short-form video creative |
| `comment_create` | Log pipeline metadata as canvas comments (audit trail) |

### Emphasis for this submission
- The MCP integration is first-class, not an afterthought
- Every creative asset is stored and organised in Melius — nothing is ephemeral
- The Melius canvas is itself a deliverable (client can iterate on assets directly)
- Demonstrate `display_canvas` in the demo to show the live canvas state

### Pitch one-liner
> "VidCard uses the Melius MCP to autonomously create, generate, and organise every creative asset in a persistent canvas — from background visuals to the final video."

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