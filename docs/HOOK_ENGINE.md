# The Hook Engine

**Status:** Design spec, in implementation
**Scope:** Melius hackathon (May 19, 11:59pm PDT) and beyond
**Purpose:** Lift nuncio from "agent-orchestrated outreach video" → "agent that turns any profile into a scroll-stopping personalised media object." This is the differentiator that moves us from *Melius wrapper* to *Melius-native new media format*.

---

## Why this exists

The reflexive critique of personalised-outreach products is that the **format is tired**: a talking head saying "Hi {{firstName}}." Even with perfect script personalisation, the recipient has seen the shape of this video a hundred times and tunes out in the first second.

TikTok and Instagram Reels solved this with a single insight: **the first 1.5 seconds is the entire product.** That window is called the hook. Every subsequent design decision serves the hook.

Outreach video has never had a hook craft. It has always opened on a face.

The Hook Engine is nuncio's answer:
> The agent picks the right visual hook archetype for this specific recipient, generates a 3–5 second cinematic opener tailored to *them*, and prepends it to the talking-head body. Hook is generated. Face is rendered. Both live on a Melius canvas the agent assembled autonomously.

This is also where nuncio earns its **Melius-native** identity. Each archetype is a different node graph: a recipe of text → image → video → composite nodes that produces a different kind of opener. The agent is choosing not just *what to say* but *what to generate, in what medium, in what shape*.

---

## The five hook archetypes

Each archetype is:
- A **selection rule** the agent uses to decide if it fits a given recipient
- A **prompt template** for the cinematic video opener (Runway / fal Veo3 / Kling / Wan)
- A **canvas template** — the set of Melius nodes and edges the agent builds
- An **edit recipe** for how the hook composes into the final HeyGen body

| # | Archetype | One-line idea | Best fit |
|---|---|---|---|
| 1 | **Mirror** | Reimagine the recipient's own work as a cinematic 3-sec generation | Founders with a visible product (PostHog → a chart that breathes; Vercel → a deploy preview that bursts into colour) |
| 2 | **Origin** | An archival-look generated shot referencing where they started | Operators and execs with a clear public origin (Sundar at IIT KGP; rauchg's early work) |
| 3 | **Future-cast** | A speculative shot of where their work leads in 5 years | Researchers, AI founders, climate / hardware founders |
| 4 | **Inside joke** | Visual riff on a *specific* recent post, talk, or article | Heavy posters on X / LinkedIn with quotable recent content |
| 5 | **Day-in-the-life** | 4 fast-cut generated scenes tied to their stated interests | People with rich public interest signals but no clear single product |

### Selection logic

The agent picks the archetype during the synthesis pass:

```
inputs:
  profile.notable_work
  profile.recent_signal     (latest post/article/talk)
  profile.role
  profile.company
  profile.interests

decision:
  if profile.recent_signal has a strong quotable hook    → Inside joke
  else if profile.company has a visible product surface  → Mirror
  else if profile.notable_work spans >1 decade           → Origin
  else if profile.role suggests forward-bet (research /
       AI founder / deep-tech)                           → Future-cast
  else                                                   → Day-in-the-life

  override: if user picked an archetype chip on /studio, honour it
```

The chosen archetype is logged to the canvas as a `comment` so future humans (and judges) can see *why* the agent did what it did.

---

## What the agent builds on Melius (per archetype)

Every archetype shares a common spine and adds archetype-specific nodes.

### Common spine (always present)
```
custom_text  Profile Summary       (enrichment output)
custom_text  Outreach Objective    (sender brief)
custom_text  Tone & Visual Dir.    (extracted style)
custom_text  Script                (HeyGen body)
image        Thumbnail             (16:9 or 9:16 per format)
group        "{name} — outreach"   (wraps everything)
comment      Agent audit trail
```

### Archetype-specific extensions

**Mirror**
```
custom_text  Hook Concept          ("reimagine the PostHog dashboard as a living organism")
image        Hook Storyboard       (single-frame still — composition reference)
video        Hook Cinematic        (3-5s generation, fal/Runway, fed into HeyGen as intro)
edges:       Hook Concept → Hook Storyboard → Hook Cinematic
             Visual Direction → Hook Cinematic
```

**Origin**
```
custom_text  Origin Beat           ("IIT Kharagpur, 1989, monsoon, dorm room")
image        Hook Storyboard       (archival-look reference still)
video        Hook Cinematic        (grainy, 4:3 letterboxed inside vertical frame)
```

**Future-cast**
```
custom_text  Speculation Brief     ("Sundar's 2030: a model that runs on your wrist")
image        Hook Storyboard       (clean, near-future industrial design)
video        Hook Cinematic        (slow push-in, single light source)
```

**Inside joke**
```
custom_text  Quoted Phrase         (verbatim phrase extracted from their recent post)
custom_text  Visual Joke           (visual restatement of the phrase)
image        Hook Storyboard
video        Hook Cinematic        (literal, slightly absurd, fast-cut)
```

**Day-in-the-life**
```
custom_text  4 Beat Brief          ("morning · stand-up · build · ship")
image[4]     Beat Storyboards      (one per beat)
video        Hook Cinematic        (4-cut compilation)
edges:       each Beat → Hook Cinematic
```

This means we now use **5+ node types**: `custom_text`, `image`, `video`, `group`, `comment` — well above the ">1 node type" requirement, and visibly so on the canvas.

---

## Format also follows the recipient

The agent decides the *output medium*, not just the message. This is a small code addition with outsized "agent extensiveness" payoff.

| Signal | Format decision |
|---|---|
| Primary platform = LinkedIn, recipient is exec | 16:9 · polished · captions optional · 60s |
| Primary platform = X, recipient is power-user | 9:16 vertical · hard-burned captions · fast cuts · ≤30s |
| Recipient prefers async DM (Slack-shaped audience) | 1:1 square · ≤25s · no music |
| Founder / builder | 9:16 vertical · single bold typographic frame at the hook moment |

The format choice is surfaced on the `/studio` recap card as a badge:
`9:16 · 22s · vertical · captions on · Mirror archetype`

Nobody else in this hackathon will think to make the agent decide the *medium*.

---

## How this composes with the existing pipeline

```diagram
╭───────────────╮   ╭───────────────╮   ╭──────────────────╮
│ enrichment    │──▶│ synthesise    │──▶│ pick archetype   │
│ (tinyfish)    │   │ (claude)      │   │ + format         │
╰───────────────╯   ╰───────────────╯   ╰────────┬─────────╯
                                                 │
                          ╭──────────────────────┴──────────────────────╮
                          ▼                                             ▼
                  ╭──────────────────╮                          ╭───────────────╮
                  │ build Melius     │                          │ generate hook │
                  │ canvas (spine +  │◀───hook video URL────────│ video         │
                  │ archetype nodes) │                          │ (fal / Runway)│
                  ╰────────┬─────────╯                          ╰───────────────╯
                           │
                           ▼
                  ╭──────────────────╮
                  │ render HeyGen    │
                  │ body, prepend    │
                  │ hook cinematic   │
                  ╰──────────────────╯
```

**New module:** `src/lib/hooks/` containing:
- `archetypes.ts` — the 5 archetypes as data: selection rules, prompt templates, canvas templates
- `select.ts` — `chooseArchetype(profile, brief, override?)` returning the chosen archetype + reasoning string
- `generate.ts` — `generateHookVideo(archetype, profile, brief)` calling fal/Runway
- `compose.ts` — `composeFinalVideo(hookUrl, bodyUrl)` stitching hook + body (server-side via ffmpeg/fal compose endpoint)

**New Melius provider methods:**
- `createVideoNode(canvasId, label, sourceUrl, position)`
- `attachVideoToNode(nodeId, sourceUrl)` (for when hook generation finishes after node placement)

**New API surface:**
- `POST /api/studio/build` — gains `archetype?` optional override in body
- `POST /api/studio/hook/regenerate` — re-roll the hook only, leaves the body alone

---

## `/studio` UX additions

Two minimal additions to the page we just shipped:

1. **Archetype chips** under the brief input on the input stage:
   `Let the agent pick · Mirror · Origin · Future-cast · Inside joke · Day-in-the-life`
   Default = "Let the agent pick"; selecting any other locks the override.

2. **Format & archetype badge** on the ready-stage recap card:
   `9:16 · 22s · vertical · captions on · Mirror archetype · why?`
   Clicking `why?` reveals the agent's selection reasoning (1–2 sentences).

3. **Hook preview** in the node inspector — the `video` Hook Cinematic node renders as a small autoplay loop so judges see the generated opener immediately, not just a URL.

4. **"Re-roll the hook" button** next to the hook node — calls `/api/studio/hook/regenerate` with the same archetype, gives a fresh take. This is the killer iteration moment for the demo video.

---

## Tiered hook generation and capture flow

The hackathon flow should stay anonymous at the front door. Judges should be able to drop a profile URL, watch the agent build the canvas, inspect nodes, see the hook, and run one first hook generation without creating an account. Email capture happens only after the user has seen value.

### Tier x model matrix

| Tier | Hook model | Hook quality | Est. cost / clip | Hook generation | Cap | Watermark |
|---|---|---|---:|---:|---|---|
| Trial, anonymous | fal Wan 2.5 | Draft cinematic | ~$0.05 | ~12s | 1 / IP / 24h | Yes |
| Free, email captured | fal LTX or Wan | Draft cinematic | ~$0.05 | ~12s | 3 / month | Yes |
| Pro, $19-29/mo | fal Kling 2.0 | Cinematic | ~$0.40 | ~45s | 50 / month | No |
| Studio, $79+/mo | fal Veo3 | Flagship | ~$1.50 | ~60s | 200 / month | No |

Wan/LTX is the right first shipped path because it is fast enough for judges and cheap enough to absorb hackathon traffic. Kling is the visible upgrade path for real social posts. Veo3 can remain a pricing-page signal until after Cut 1; it proves the model ladder without adding integration risk today.

### Email capture points

Do not gate `/studio` entry. Ask for email only when intent is high:

- Downloading the final composed video
- Creating the `/v/[id]` campaign share link
- Saving a canvas to return later
- Starting a second hook re-roll

The modal copy should be specific and immediate:

> Drop your email to unlock 2 more free hook generations and get a campaign link for this recipient.

After capture, the session tier flips from `trial` to `free`, the current canvas stays live, and the UI unlocks two additional hook generations. The modal should not become an account-creation wall during the hackathon.

### Abuse controls

- Use `src/lib/rate-limit.ts` for anonymous trial caps: 1 Wan generation per IP per 24h.
- Add a cookie fallback for office/mobile-carrier IP collisions.
- Track daily hook spend behind `HOOK_DAILY_BUDGET_USD`; when exceeded, soft-fail to demo hook mode while still building the canvas.
- Add captcha only after repeated duplicate/failed attempts from the same IP.
- Add a hidden honeypot field to the email capture form.

### Session data shape

Extend share/session storage conservatively rather than introducing account infrastructure:

```ts
type UserTier = "trial" | "free" | "pro" | "studio";

interface SessionRecord {
  ip: string;
  email?: string;
  tier: UserTier;
  usage_this_month: number;
  created_at: Date;
}
```

`POST /api/studio/build` should resolve tier from `email || ip`, choose `HOOK_MODEL_FOR_TIER[tier]`, record estimated spend, and return `{ tier, remainingFree, canRegenerate }` alongside the canvas result so `/studio` can decide when to show the email modal.

### Pricing page positioning

The current `/pricing` page is in beta/test mode, so it should act as business-model proof rather than a hard monetization surface. Keep the existing Pro checkout path working, but show all four tiers and the exact hook model each tier uses. The story for judges is: the agent does not just generate content; it also chooses an economically appropriate model for the recipient and campaign stakes.

---

## Why this wins the Melius hackathon specifically

Mapped to the published criteria:

| Criterion | Pts | Without Hook Engine | With Hook Engine |
|---|---|---|---|
| Challenge Prompt Adherence | 2 | 7/10 — fits "something you wish existed" loosely | 9/10 — *a new media format* did not exist before |
| Boundary Pushing | 5 | 7/10 — agent-on-Melius is novel | 9/10 — agent picks archetype, format, *and* generates the cinematic asset |
| Execution & Polish | 4 | 8/10 — clean Studio page | 8/10 — same, plus hook preview |
| Creativity & Uniqueness | 5 | 6/10 — outreach is stale | 9/10 — *the output itself* is now novel; each canvas looks different from the next |
| Extensiveness of Agent Use | 4 | 9/10 — many MCP tools | 10/10 — also `create_video_node`, multi-archetype branching, format decisioning |

Expected uplift: **~14 weighted points → strong contender for Best Use of Platform/AI ($2.5k) and a real shot at Best Overall ($6k).**

---

## Implementation plan (build-then-polish)

### Cut 1 — minimum demonstrable Hook Engine (~3h)
- [x] `src/lib/hooks/archetypes.ts` — data definitions for all 5 archetypes
- [x] `src/lib/hooks/select.ts` — deterministic archetype selector
- [x] `src/lib/hooks/generate.ts` — fal video generation path with demo fallback when the endpoint is not configured
- [x] `MeliusProvider.createVideoNode` — creates a Melius `video` node and can attach a generated source URL
- [x] `build/route.ts` integration — agent picks archetype, creates Hook Concept + Hook Cinematic nodes, returns tier/model usage metadata
- [x] `/studio` archetype chips on input + badge on recap

### Cut 2 — all five archetypes, format decisioning (~2h)
- [ ] Wire prompt templates for archetypes 2–5
- [ ] `pickFormat(profile)` helper + format badge on recap
- [ ] Hook preview node renders as autoplay video in inspector

### Cut 1.5 — email capture and soft gates
- [x] Email capture modal appears only on high-intent actions: hook re-roll, share link, download/export
- [x] Capture uses email + honeypot and stores a private campaign/share record through the existing share store
- [x] Captured email unlocks 2 additional hook generations for the current Studio session
- [x] Hook re-roll calls a dedicated endpoint and attaches the new hook video URL back to the Melius video node when available

### Cut 3 — polish & demo readiness (~1h)
- [x] "Re-roll hook" button → `/api/studio/hook/regenerate`
- [ ] Selection reasoning surfaced behind `why?` link
- [ ] Update demo flow (`?demo=true`) to show a baked Mirror archetype with a real generated hook video

### Out of scope (post-hackathon)
- Faceswap of sender face onto hook character (legal review needed first)
- Branching narrative hooks (recipient can click between two variants)
- A/B reply-rate measurement for archetypes — feedback loop into selection rule

---

## Open questions for the build

1. **Which video model?** Defaults to fal Veo3 for cinematic quality; Kling for motion; Wan for fast iteration. Pick one as primary, leave the others as A/B options via env var.
2. **Compose strategy** — server-side ffmpeg (heavier, deterministic) or fal `compose` endpoint (lighter, less control). Spike ffmpeg first.
3. **Hook duration** — fixed at 3s? Or archetype-dependent (Mirror 3s, Day-in-the-life 5s)? Start fixed-3s for simplicity, revisit if it looks rushed.
4. **Fallback when hook generation fails** — degrade gracefully to body-only, surface the failure as a warning, don't block the canvas.

---

## What this changes in the submission pitch

**Before:**
> nuncio's agent builds a complete Melius canvas from a single social profile URL — text nodes, image generation, wired edges, all visible and iterable. The canvas IS the deliverable.

**After:**
> nuncio's agent reads a profile, picks the right *visual hook archetype* for that person, then composes a Melius canvas where the hook is generated as cinematic video alongside the script — every node, edge, format, and creative decision made autonomously and visibly. The canvas isn't just where the work lives. It's *how the agent thinks*.

That second sentence is the one judges will lift into their summary.
