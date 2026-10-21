# Design

## Principles

**1. The conversation is the product; the video is the artifact.**
Per `docs/STRATEGY.md`, the live conversation is the product — the recorded video is the fallback artifact inside the live link. The UI exists to collect an input and deliver a first touch. Every design decision should reduce friction between "I want to reach this person" and "they're talking to my twin." Avoid feature creep in the interface.

**2. Specificity must be visible.**
The recipient should be able to tell, within the first few seconds, that the video was made for them. Vocal personalisation is not enough. The visual system should reference the recipient, the sender's offer, and the reason for reaching out.

**3. Progress, not waiting.**
Video generation takes 60–180 seconds. That time cannot be compressed. The UI must make it feel purposeful — show the user what the agent is doing at each stage, not just a spinner.

**4. Confidence through specificity.**
The generated script should feel genuinely personalised, not templated. The UI should surface which specific details were used (e.g. "Referenced: your role at Stripe, your thread on ZK proofs") so the sender can verify before rendering.

**5. One flow, no dead ends.**
The happy path is: enter URLs → review script → render video → copy link. Every failure state should offer a clear next action — retry, edit, or skip — not a blank error screen.

---

## User flow

### Step 1 — Input

```
┌──────────────────────────────────────────────┐
│  Who is this for?                            │
│                                              │
│  LinkedIn URL  [________________________]    │
│  Twitter/X     [________________________]    │
│  Farcaster     [________________________]    │
│  Other URL     [________________________]    │
│                                              │
│  Why should this conversation happen?        │
│  [______________________________________]    │
│                                              │
│  What can you show them?                     │
│  [Screenshot] [Proof point] [Relevant URL]   │
│                                              │
│  [Generate video →]                          │
└──────────────────────────────────────────────┘
```

- All fields optional except at least one URL
- Inline validation on blur (is this a valid profile URL?)
- "Other URL" is a catch-all for personal sites, GitHub profiles, etc.
- Sender context is not optional in practice: the product needs a reason, an offer, and at least one proof asset to make the video visually specific
- Voice input can fill the same brief, but the structured brief remains the source of truth

### Step 2 — Agent progress

```
┌──────────────────────────────────────────────┐
│  Building your video...                      │
│                                              │
│  ✓  Fetching profiles          0.8s          │
│  ✓  Analysing context          2.1s          │
│  ✓  Choosing visual hook       2.8s          │
│  ◌  Writing script...                        │
│  ○  Composing proof scene                    │
│  ○  Rendering video                          │
│                                              │
│  Usually takes about 90 seconds.             │
└──────────────────────────────────────────────┘
```

- Each step lights up as it completes with a checkmark and elapsed time
- The current step shows a subtle pulse animation
- No estimated total time on individual steps — only a general "about 90 seconds" message
- If any enrichment URLs failed (e.g. login wall), show a soft warning: "Couldn't access Twitter — continuing with LinkedIn only"

### Step 3 — Script and visual review

```
┌──────────────────────────────────────────────┐
│  Review before rendering                     │
│                                              │
│  "Hey Sarah — I came across your work on     │
│  the Stripe Atlas team and your recent post  │
│  on cross-border payments was spot on.       │
│  I'm building something in that space and   │
│  think you'd have a sharp take on it..."     │
│                                              │
│  Based on: LinkedIn · Twitter (3 posts)     │
│  Opening visual: Stripe Atlas post           │
│  Proof visual: payments API screenshot       │
│                                              │
│  [Edit script]  [Render video →]             │
└──────────────────────────────────────────────┘
```

- Full script is shown — sender reads before committing credits
- Small attribution line shows which sources were used
- Inline edit mode (simple textarea, not a separate page)
- Word count indicator (200 word limit for avatar delivery)
- Visual plan is shown before rendering: opening signal, proof asset, motion graphic, and close
- Sender can replace an asset or remove a visual reference that feels weak

### Step 4 — Video ready

```
┌──────────────────────────────────────────────┐
│  ✓  Your video is ready                      │
│                                              │
│  [Video player — 16:9]                       │
│                                              │
│  [Copy link]  [Download]                            │
│                                              │
│  Generate another →                          │
└──────────────────────────────────────────────┘
```

- Autoplay muted on arrival (user unmutes to watch)
- Two CTAs: copy shareable link, download mp4
- "Generate another" resets to step 1 with fields cleared

---

## Live call-request UX (twin → human bridge)

Per `docs/STRATEGY.md`, the live link is a personal front door — the recipient can ask the twin, request the sender now, or book time. The UI must never blur "request sent," "request accepted," and "sender is actually in the room."

### Recipient (`CallRequestPanel` on `/live/[id]`)
- Compact card below the twin controls; cream surface, Instrument Serif headline, muted mono labels — no new visual language.
- States: `Request a call now` → `Waiting for {sender} to respond` (pending, poll every 3s) → `Request accepted — preparing call…` (background join binding; no premature Join) → a single `Join call` once the room is ready → `Waiting for {sender} to join` → `{sender} joined` (only on observed room presence, never on acceptance). A reused twin room auto-connects on the bound join — the request itself is the explicit intent, no second click.
- Declined/expired states collapse back to the twin + booking-link alternatives — never a dead end.
- Microphone access only on the explicit "Join call" click; no camera, ever. Autoplay-blocked audio shows a visible "Enable audio" control.
- Request capability token lives in memory only — never in the URL or localStorage.

### Owner (`CallRequestsCard` on `/dashboard`)
- Availability toggle is explicit and expiring ("Available for calls — 15 min"), never inferred from a calendar. Pending requests list with accept/decline; accepted state shows a "Join call" button — no automatic mic/camera prompts. Accept/Join show optimistic busy states (`Accepting…` / `Joining…` with spinner, buttons disabled) so double-clicks never double-fire.
- Owner-facing setup fields (`synthesiaAvatarId` `av_*`, `liveVoiceId`, identity, playbook, booking URL) live in the Setup view (`/setup`, `SetupPanel`) — not inside the inbox card.

### Shared room (`LiveCallRoom`)
- One component for owner and recipient; distinct LiveKit identities (`owner-<userId>` / `recipient-<requestId>`), audio-only publish grants.

### Text→live handoff entry (`/live/[id]` with `handoffId` marker)
- The live start controls, `CallRequestPanel`, and booking link render as three peer cards under "Choose how to continue" so the recipient never has to start the paid avatar session to see their options. Cards: "Ask the AI representative" (Questions first, without scheduling), "Request {sender}" (availability- and acceptance-gated), "Choose a time" (only when a valid configured HTTPS booking URL exists). During the human-call phase a top "Human call room" banner marks the phase — observed participant presence remains the `LiveCallRoom` component's job; the banner does not claim anyone joined. The avatar stage stays mounted but hidden.
- A `Before you join` lobby (Check mic + disclosure + mic status) precedes session start; a passed lobby check lets Join skip the second mic probe so the worker starts sooner. Mic state resets every session. The Join control shows `Joining…` with spinner while starting. After deliberate endings (manual / max-duration / human handoff), a `What they asked about` debrief card renders persisted metric labels only (`userTurns`, `questionTopics`, `bookingClicked`) — never raw dialogue.
- Recipient names are share-record only, never inferred: the twin prompt falls back to a generic greeting when `share.recipientName` is absent, and the front-door greeting renders only for a trimmed non-empty name.
- Eyebrow is "A personal invitation" for bearer-protected handoffs (possession of the link is not verified identity) and "Conversation link" for ordinary shares. Heading: "A conversation with {sender}"; protected handoffs add "Continue the conversation started by {sender}".
- `recommendedNextStep` is advisory only and never auto-starts anything.
- Handoff context stays server-side — the private summary is not returned in public share/status APIs, though the twin may refer to its contents; the owner sees it in the dashboard inbox as "Text conversation context" before accepting and inside the connected call view.
- **Recipient-reviewed live brief**: the recipient can optionally ask for a draft brief ("Draft brief" sends the conversation to the AI service only on that explicit click), review/edit the four fields, and check "Share this brief" before it accompanies the call request. The brief is a recipient-reviewed draft — never a transcript, never verified fact; the owner UI labels it accordingly. The nuncio app never persists, logs, or returns raw dialogue via status/join APIs (provider/observability retention is operator-visible separately); only the owner inbox surfaces the reviewed brief.

### Homepage journey illustration (`RelationshipJourney`)
- `#prospect-experience` is a single self-contained, manually steppable illustration (Alex → Maya) labeled "Illustrative journey · not a live session" — four stages (First touch / Your choices / Request / Human call) with `aria-pressed` stage buttons, reduced-motion respect, and no autoplay, timers, network, or real chat/call UI.
- It teaches the actual branch semantics: ask the AI, request the sender, or choose a configured scheduling link; a request is not an acceptance, and a human call happens only when the owner accepts and both participants join — the AI steps aside. No qualification is implied and no call auto-connects.

### Information architecture (single source of truth: `src/lib/navigation.ts`)

The app has **three spaces**, each a real route, each with a one-line description shown next to the label so the user never has to guess which is which:

| Space | Route | What it is |
|---|---|---|
| Inbox | `/dashboard` | Requests, live sessions and bookings — everything a prospect sends back |
| Your representative | `/setup` | Who it speaks for, and what it may promise |
| Create | `/studio` | Make a first touch from a prospect's profile |

Rules that keep the surfaces disambiguable:

- **No navigation differs only by a query string.** Setup used to live at `/dashboard?view=setup`; that URL now redirects to `/setup` so a bookmark, a browser-history entry and a shared link all say the same thing.
- **"Playbook" means your representative's playbook, always.** The public worked examples moved from `/playbook` to `/examples` (old URL redirects) precisely because the same word was used for two different things.
- **One primary action.** `Create` is the only filled button in the header; Batch, Worked examples and Plan & credits live in the account menu (and the mobile menu's "More" group).
- **Every destination carries a description.** Member surfaces are `memberOnly` — an anonymous visitor is never offered a page that dead-ends at the login wall.
- `PRODUCT_ONELINER` ("Nuncio runs an AI representative that talks to your prospects using the playbook you set.") is rendered in the app shell — the Inbox header, the Setup header and the tour — so what the app *is* is never more than one sentence away.

### The representative — who answers

The user's question ("for an avatar app, surprisingly barren of avatars and examples of the experience users can expect") was pointing at a capability that already existed and was invisible: `POST /api/anam/avatar` trains a live avatar from a photo and persists it to the workspace, but the upload lived three clicks deep in the studio's video-customization panel and the rendered face was never shown to anyone.

`src/lib/representative.ts` is the single description of *who answers*, with **two kinds that never collapse into one another**:

| Kind | What it is | What the prospect is told |
|---|---|---|
| `self` | the representative uses the sender's own photo | "It uses the sender's photo and answers only from the sender's notes." |
| `persona` | a disclosed provider persona standing in for the sender | "It is not the sender — it stands in for them, and answers only from the sender's notes." |
| `unset` | no avatar configured | "You are talking to an AI representative. It answers only from the sender's notes." |

"May not resemble you" and "is you" are different promises, and a prospect is entitled to know which one they are getting. The disclosure sentence is derived from the kind, so no surface can accidentally imply the wrong one.

**The house conversation language.** `RelationshipJourney`'s `Bubble` is the app's conversation primitive, and its colour *is* the disclosure: the disclosed AI is the soft accent bubble, a human is the ink bubble. An AI must never be drawn like a person — so the example, the preview and the lobby all use the same mapping (`bg-accent-soft/60 border border-accent/20` for the representative, `bg-ink text-cream` for the human, the human on the right). Colour says "this is the AI" before the words do.

**One `<Face>` primitive** (`src/components/face.tsx`) — every person in nuncio is a circle, so the shape is enforced in one place rather than reinvented per surface. It re-points Anam's image at the provider's **portrait** variant (the landscape one is 3:2 and gets its sides cut when cropped to a circle), falls back to initials, and can play the avatar's clip.

**The face that will actually answer.** The description is resolved against the same provider order the live session uses (primary → anam → masky), so the app never shows a face that will not be on the call. A workspace with no photo avatar resolves to the deployment's default persona — named, pictured and moving — because that is what will answer. The still image is snapshotted onto the share record; the clip is a presigned URL and is resolved per request.

Where the representative appears:

- **Setup → "3 · Who answers"** — the two honest paths ("Use my photo" / "Use a disclosed persona"), the rendered avatar with a playable preview, and the exact sentence the prospect will read.
- **Setup → prospect preview** — the face beside the disclosure line, so the sender sees the whole front door.
- **The prospect's lobby** (`/live/[id]`) — the face and the disclosure *before* the mic check. A prospect should never be asked to trust a voice with nothing to look at.
- **The studio** — shows the configured representative and links to Setup to change it. The studio is no longer the place where a representative is configured.
- **The landing page hero** — `RepresentativeScene`: the *prospect's actual screen*, rendered as live components rather than described. A stacked **deck of faces** under the frame lets a visitor flick through the three ways a representative can have one — the default persona, another persona from the library, and your own photo — and the face, the name, the opening line and the disclosure all change together, because that is what a sender is actually choosing. Arrow keys work; the exchange replays on each change. — the frame the session uses with the representative moving in it, the exchange in the house conversation language, and the three real ways the recipient can continue. A diagram of a conversation is not a conversation, and a product whose whole claim is *a face that talks* cannot lead with a wireframe. The exchange plays once when the scene scrolls into view.
- **The landing page, after the hero** — the contrast ("A link nobody opens. A conversation that books itself.") and `PromiseCards`: four warm-tinted cards, each making one promise and showing the real artefact that proves it. We have no customer testimonials, and inventing them would be the easiest possible lie on a page whose subject is disclosure — so the cards show the representative's actual lines and the actual choice the recipient gets. The flow diagram (`RelationshipJourney`) follows as "What happens after you send it".
- **The landing page, below the hero** — `RepresentativeExample`, a scripted exchange labelled "Illustrative conversation · not a live session", so the shape of the conversation is visible before anyone signs up.

The kind, the name and the image are **snapshotted onto the share record** when a link is created, so a prospect sees the same face they were shown even if the sender later changes it. The provider avatar ID (`av_…`) moved into "6 · Advanced — provider details", is never shown to a user as a headline, and the advanced section says plainly that it is ignored when a photo avatar is configured.

### Sender proof — the human behind the AI

A stranger deciding whether to talk to an AI needs more than initials in a circle. The sender can publish three things, all snapshotted onto the share record when the link is created so a later change never rewrites what a prospect was shown:

| Field | Where it is set | Where it appears |
|---|---|---|
| Photo | `/setup` → "2 · Trust proof" | `SenderTrustBadge` avatar on `/v/[id]` and `/live/[id]`; the prospect preview |
| Company logo | `/setup` → "2 · Trust proof" | Next to the sender's name in the trust badge |
| "What can your representative answer?" | `/setup` → "2 · Trust proof" | One line under the trust badge, before the prospect decides |

Rules (`src/lib/sender-proof.ts`):

- **https only** — `normalizeImageUrl` rejects http, `javascript:`, `data:` and credentialed URLs. Mixed content would silently break the badge.
- **The can-answer line is sender-written, capped at 160 characters.** It is never auto-summarised from the playbook: a promise made to a prospect must be one the sender actually chose to make.
- **The snapshot wins.** `senderProofForShare` prefers the share snapshot and falls back to the live workspace only for links created before the field existed.

### The inbox read model (`src/lib/inbox.ts`, `GET /api/inbox`)

The dashboard used to fetch first touches, live sessions and bookings separately and ask the client to work out what they meant together. One workspace-scoped endpoint now joins them server-side and returns a **relationship state** per first touch, so the Inbox answers "where is Maya?" instead of listing links.

| State | Meaning | Signal |
|---|---|---|
| `sent` | created, never opened | no view, no session |
| `opened` | the recipient opened the link | `firstViewedAt` |
| `talking` | a live session started | a session for that share |
| `booked` | a booking exists | a scheduling record for that share |
| `requested` | a human call request is waiting on the owner | a pending/accepted call request |

A pending call request outranks a booking — a prospect asking for the human is the most urgent thing on the list. `deriveRelationshipState` is a pure function and is unit-tested.

**One request, three cards.** The dashboard polls `/api/inbox` every 15s and passes `entries`, `sessions` and `bookings` down to the first-touch list, the scoreboard and the bookings card. Previously each card fetched and polled on its own.

**View beacon.** `POST /api/share/[id]/view` records that a prospect opened a link (`firstViewedAt`, `viewCount`). It stores a timestamp and a counter — no IP, no user agent, no recipient identity. The sender's own view never counts, invitation-protected links are never counted, and the route is rate-limited (`RATE_LIMITS.shareView`).

### Studio: one obvious path

The studio is the largest remaining surface, so it follows the same rule as the nav — one obvious answer per question:

1. **Profile URL** — the primary input, first thing on the page.
2. **Your name** and **Brief** (with sample chips).
3. **"Rather say it?"** — one secondary action (Brief by voice). The capture-playbook action was removed from here: the playbook lives in `/setup`, so that is where you talk it through.
4. **"More options"** — a collapsed disclosure for research depth, live vs recorded, hook style and the booking link, with a one-line description of what is inside.

A **no-playbook notice** appears above the CTA when the workspace has no playbook: the sender can send this one now and set the playbook later. On `/setup`, an unconfigured workspace gets a **"Start with one message"** card offering the same thing. Configuring first is the right advice for everyone else, and nagging a configured user is noise.

### Dashboard views
- `/dashboard` (Inbox) = operational inbox: "Needs your attention" (`ApprovalsCard`, `CallRequestsCard`), "Bookings" (provider-verified bookings; empty state links the teaching ladder at the booking step), "Sent first touches" (the `entries` projection of `GET /api/inbox`, each row carrying its relationship state and a plain-language sentence; empty state links the ladder at the first-link step), plus a compact "Your representative" readiness aside and a collapsed "Usage & account" section (scoreboard empty state links the ladder at the conversation step; non-empty scoreboards carry a latest-session debrief card — metric labels only, never dialogue).
- `/setup` = `SetupPanel`: identity, trust proof (photo, company logo, "what can your representative answer"), playbook, scheduling (HTTPS-only booking URL input), and collapsible provider fields, with a server-loaded status checklist — configuration presence, never provider health. The checklist reports "unknown" while readiness can't be fetched, and derives only from the last saved server snapshot, not unsaved form input. `SetupPanel variant="summary"` renders the same saved statuses (no form) in the Inbox aside. Setup guides blank fields with `e.g.` placeholders (Alex/Northwind fiction), a `Try an example` fill (dirty-marked, never autosaves), a **Talk it through** voice capture (playbook mode, fills the playbook fields via the shared `mapVoiceProfile` mapping), a live prospect preview that reacts to unsaved typing, a `Hear your twin` TTS preview of the disclosure line (non-blocking errors), staged save states (`Saving…` → `Saved ✓` + `Preview updated` + one reduced-motion-aware pulse), and a coverage meter (`n/5`: wants/offer/constraints + wiggle-room + identity) labelled "What your representative knows".
- Login return target: `resolveLoginNext` (`src/lib/auth/login-next.ts`) allowlists only `/setup`, `/dashboard`, `/dashboard?view=setup` (legacy), `/studio`, `/pricing`, `/examples`, `/batch` — everything else falls back to `/studio`. The `next` param flows LoginForm → `POST /api/auth/login` → verify-link query → `/api/auth/verify` redirect, and is preserved on error redirects.

---

## Component inventory

### Input form
- URL input fields with platform detection (show LinkedIn icon if URL matches `linkedin.com`, etc.)
- Submit button disabled until at least one valid URL is entered

### Progress stepper
- Vertical list of steps
- Three states per step: pending (gray), active (pulse), complete (checkmark + elapsed time)
- Driven by SSE or polling — updates without page refresh

### Script card
- Monospace or slightly humanised font for the script text
- Editable textarea in edit mode
- Word count badge (green under 180 words, amber 180–200, red over 200)
- Source attribution chips (small pills showing which platforms contributed)
- Review-stage sender/playbook fields carry `e.g.` placeholders (Alex/Northwind fiction); brief input offers Warm/Crisp/Bold sample chips that fill brief + tone
- Capture actions show busy labels (`Working…`, `Saving…` for brief saves) with buttons disabled to prevent double-submit

### Video player
- Native `<video>` element, no third-party player for MVP
- 16:9 aspect ratio
- Poster frame: first frame of video

### Error states
- Inline, not modal
- Always show what failed and what the user can do next
- Example: "Twitter profile couldn't be accessed. [Try adding a LinkedIn URL instead] or [Continue without it]"

---

## Visual direction

**Tone:** Clean, fast, professional. Not playful or over-branded. This is a tool for people who send outreach — they want it to look credible, not cute.

**Colour:** Near-monochrome base (white/off-white background, dark text) with a single accent colour for interactive elements. No gradients. No decorative illustration.

**Typography:** System font stack for body copy (`font-sans`). Display headlines use `Instrument Serif` (`font-display`) for an editorial, credible tone. Use the project's explicit type scale utilities instead of arbitrary pixel sizes:

| Old utility | Replacement | Notes |
|-------------|-------------|-------|
| `text-[9px]` | `text-label-xs` | 11px mobile → 9px on sm+ |
| `text-[10px]` | `text-label-sm` | 12px mobile → 10px on sm+ |
| `text-[11px]` | `text-label-base` | 14px mobile → 11px on sm+ |
| `text-xs` | `text-body-xs` | 14px mobile → 12px on sm+ |
| `text-sm` | `text-body-sm` | 16px mobile → 14px on sm+ |

Use `text-label-*` for uppercase microcopy/eyebrows and `text-body-*` for readable sentences. Avoid hardcoded `text-[9-11px]` and `text-xs`/`text-sm`; they bypass the mobile bump and break the type system.

**Motion:** Minimal but intentional. Prefer explicit `transition-[property,property,...]` lists over `transition-all`. Never put a `transition` on `*:focus-visible`; keyboard focus rings must appear instantly. Hover animations are fine when they are micro-interactions (scale, shadow, colour) and do not block interaction.

**Layout:** Single-column, centred, max-width ~600px. Mobile-first. The flow is linear — no sidebar, no tabs, no navigation for MVP.

## Account Film Composition

The next video format should be an account-specific film, not a full-screen avatar monologue.

### Default structure

- **0-3s target hook:** recipient name, company, product surface, recent post, or public signal
- **3-12s reason:** motion graphic explaining why the outreach is relevant now
- **12-22s proof:** sender screenshot, case study result, metric, deck slide, or customer example
- **22-30s close:** avatar or voice-led ask with one clear next step

### Asset inputs

- Product screenshot or short screen capture
- Sender logo or product mark
- One proof point, metric, or customer reference
- Optional relevant URL that supports the reason for reaching out

### Channel scope

Start with one polished format before expanding:

- Primary: LinkedIn/email share page, 16:9 or square depending on current render constraints
- Later: cropped social variants for Instagram and X
- Out of scope for now: a general motion graphics editor, arbitrary template builder, or channel-by-channel creative suite

---

## Accessibility

- All form fields have visible labels (not placeholder-only)
- Progress stepper uses `role="status"` with live region updates for screen readers
- Video player includes captions track if available from HeyGen
- Colour is not the sole indicator of state (icons + text accompany colour changes)
- Keyboard-navigable throughout — no mouse-only interactions

---

## Copy guidelines

- **Headings:** sentence case, direct ("Who are you sending to?" not "Video Personalisation Input")
- **Buttons:** verb-first ("Generate video", "Copy link", "Edit script")
- **Error messages:** explain what happened + what to do ("Couldn't access that profile. Try a different URL or continue without it.")
- **Progress labels:** present tense, active voice ("Fetching profiles", "Writing script", "Rendering video")
- **Avoid:** "AI-powered", "magic", "seamless", "revolutionary" — let the output speak for itself

---

## Batch mode

The batch page (`/batch`) introduces a new flow for multi-profile campaigns. It uses the shared `Header` and a page-level empty state with a clear CTA.

```
┌──────────────────────────────────────────────┐
│  Batch                                       │
│  Create and manage batch video campaigns.    │
│                                              │
│  [Create your first batch]  [New batch]     │
│                                              │
│  ┌──────────────────────────────────────────┐ │
│  │ Campaign A          3/5   ████░░  60%   │ │
│  │   Alice Chen           ✓  [View]        │ │
│  │   Bob Park           ⟳  [Retry]        │ │
│  │   Carol Smith         ✗  Network err  [D]│ │
│  └──────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────┐ │
│  │ Campaign B          5/5   █████  100%   │ │
│  │   David Kim            ✓  [View]        │ │
│  │   Eve Lee              ✓  [View]        │ │
│  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

- Summary header shows aggregate counts (campaigns, profiles, done, failed)
- Each campaign card has a progress bar (animated, percentage + fraction count)
- Job rows show: name, status icon, video link (if done), retry (if failed), delete button. Action buttons are always visible.
- The campaign row expander is a `div` with `role="button"` so it can contain real action buttons without invalid native `<button>` nesting.
- Auto-polls every 3s while any job is processing
- Delete shows a confirmation before removing
- Form for creating a new campaign takes a comma-separated list of URLs and a sender brief
- Form shows loading state during submission and error messages inline

## Auth header & account menu

The shared `Header` component is fixed at the top with a `bg-cream/80 backdrop-blur-md` background, subtle border, and `pointer-events-auto` so it remains readable and clickable over page content.

When signed in, the header shows the three spaces plus the credits pill and the account menu:

```
[Logo]  Inbox  Your representative  [Create]   [142 cr]  [email@example.com ▼]
                                                              ┌──────────────────┐
                                                              │ email@me.com      │
                                                              │ Pro plan          │
                                                              │ 142 credits       │
                                                              │───────────────────│
                                                              │ Inbox             │
                                                              │ Your representative│
                                                              │ Create a first touch│
                                                              │───────────────────│
                                                              │ Batch outreach    │
                                                              │ Worked examples   │
                                                              │ Plan & credits    │
                                                              │───────────────────│
                                                              │ Show tips         │
                                                              │ Sign out          │
                                                              └──────────────────┘
```

- The three spaces come from `MEMBER_NAV` in `src/lib/navigation.ts`; each has a `description` used as the link's `title` and as the sub-line in the mobile menu.
- `Create` is the only filled button (primary action); `Inbox` and `Your representative` are plain links, with the current route in the accent color.
- Secondary surfaces (`Batch outreach`, `Worked examples`, `Plan & credits`) live in the account menu and in the mobile menu's "More" group — never in the top bar.
- Account menu is a simple dropdown triggered on click
- Displays email, plan name, current credit balance
- "Show tips" dispatches the onboarding-open event — the tour is mounted once, in the root layout, so it opens from any page
- "Sign out" calls `POST /api/auth/logout`
- When not signed in, the header shows only the public surfaces (`Worked examples`, `Plan & credits`) and a "Sign in" link
- Pricing page is always accessible (even before sign-in)

## Pricing page

```
┌──────────────────────────────────────────────┐
│  Pricing                                      │
│                                               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │ Pro     │  │ 100 Cr. │  │ 500 Cr. │       │
│  │ $39/mo  │  │ $15     │  │ $99     │       │
│  │ 200 cr. │  │ 1-time  │  │ 1-time  │       │
│  │ [Buy →]  │  │ [Buy →]  │  │ [Buy →]  │       │
│  └─────────┘  └─────────┘  └─────────┘       │
│                                               │
│  Also: Pro Annual $390/yr (2400 credits)      │
└──────────────────────────────────────────────┘
```

- Clean 3-column card layout
- Each card shows plan name, price, credit count, purchase CTA
- The Pro card has a single "Recommended" pill badge; the eyebrow text is not duplicated
- Stripe Checkout opens in same tab after clicking
- After successful payment, user is redirected back to `/studio`
- Pricing page is server-rendered, uses `NEXT_PUBLIC_STRIPE_*` env vars for price IDs

## Updated component inventory

### Batch components
- **Campaign card** — rounded card with progress bar, job list, summary count
- **Progress bar** — `transition: width 500ms ease;` with fraction label (e.g. "3/5")
- **Job row** — name + status icon + action buttons (View/Retry/Delete)
- **Delete button** — small "×" or "D", only on completed/failed jobs, with confirmation
- **Inline error** — red badge below failed job row showing the error message

### Auth components
- **Account dropdown** — `position: absolute` dropdown from header, click-to-toggle
- **Session indicator** — email text in header, login link when absent
- **Session middleware** — protection check before protected routes

---

## Dashboard

The dashboard (`/dashboard`) is the post-login landing page that unifies all nuncio experiences:

```
┌─────────────────────────────────────────────────────────────┐
│  Welcome back, sarah@example.com                            │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Credits       │  │ This month   │  │ Quick actions     │  │
│  │    142        │  │ 8 videos     │  │ [Studio] [Batch]  │  │
│  │  $39/mo · Pro │  │ 88 credits   │  │ [Pricing]         │  │
│  │  Recent: -11  │  │ 3 campaigns  │  │                   │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  Recent activity                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Today                                                     ││
│  │ ✓ Alice Chen — Studio video               [View]        ││
│  │ ◌ Campaign A — 3/5 profiles               [Open]        ││
│  │ ✗ Bob Park — Batch campaign               [Retry]       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Sections:**
- **Credit card** — balance, plan name, recent transactions (last 5), "Buy credits" CTA
- **Usage summary** — total videos, completed count, active campaigns, total campaigns
- **Quick actions** — Studio, Batch, Pricing with icons and descriptions
- **Recent activity** — unified feed of both share records and batch campaigns, grouped by date, with status icons and action links. Action buttons are always visible (not hover-only) so touch/mobile users can reach them.

**States:**
- **Loading:** skeleton placeholders for all sections
- **Empty:** "No videos yet" with CTA to create first video
- **Signed out:** redirects to `/login`

**Data sources:**
- `/api/account/session` — auth check, plan, basic balance
- `/api/billing/balance` — credit balance + transaction history
- `/api/videos/recent?workspaceId=X` — recent share records filtered by workspace
- `/api/batch` — recent batch campaigns

## Onboarding modal

Mounted once, in the root layout (`src/app/layout.tsx`), so "Show tips" works from every page. Auto-opens on the three member surfaces (`/dashboard`, `/setup`, `/studio`) for signed-in members only — an anonymous explorer has nothing to set up yet.

The first panel answers "what is this app?" before any task; the rest walk the three steps:

```
┌──────────────────────────┐
│ ━━━━━━━━━━━━━━━━━━━━━━  │
│                          │
│ What nuncio does         │
│                          │
│ Nuncio runs an AI        │
│ representative that talks │
│ to your prospects using  │
│ the playbook you set.    │
│                          │
│ 1 Send a link            │
│ 2 They talk              │
│ 3 They book              │
│                          │
│ Skip              Next → │
└──────────────────────────┘
```

- **4 panels:** "What nuncio does" → "1. Set up your representative" → "2. Create a first touch" → "3. They choose how to continue". Panels 2 and 3 link straight to the surface they describe.
- **Copy is shared** with the teaching ladder (`GETTING_STARTED_STEPS` in `src/lib/navigation.ts`) so the tour and the empty states never drift apart.
- **Tracking:** `localStorage` (`nuncio_onboarding_done_v2` key, via `src/lib/onboarding.ts` — one key, one owner, so "Show tips" can actually bring the tour back)
- **Dismissible:** close button, "Skip" link, or "Got it" on last step
- **Replayable:** "Show tips" button in the account menu, from any page
- **Animation:** modal fades in with backdrop blur, steps slide horizontally
- **Progress indicator:** segmented bar at top shows position

---

## Hackathon demo mode (retired)

The pre-filled demo shortcut was removed after the hackathon. The app now runs at full speed
for all users with the live pipeline enabled on every request.
