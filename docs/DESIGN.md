# Design

## Principles

**1. The video is the product, not the app.**
The UI exists to collect an input and deliver an output. Every design decision should reduce friction between "I want to send someone a video" and "the video is ready." Avoid feature creep in the interface.

**2. Progress, not waiting.**
Video generation takes 60–180 seconds. That time cannot be compressed. The UI must make it feel purposeful — show the user what the agent is doing at each stage, not just a spinner.

**3. Confidence through specificity.**
The generated script should feel genuinely personalised, not templated. The UI should surface which specific details were used (e.g. "Referenced: your role at Stripe, your thread on ZK proofs") so the sender can verify before rendering.

**4. One flow, no dead ends.**
The happy path is: enter URLs → review script → render video → copy link. Every failure state should offer a clear next action — retry, edit, or skip — not a blank error screen.

---

## User flow

### Step 1 — Input

```
┌──────────────────────────────────────────────┐
│  Who are you sending to?                     │
│                                              │
│  LinkedIn URL  [________________________]    │
│  Twitter/X     [________________________]    │
│  Farcaster     [________________________]    │
│  Other URL     [________________________]    │
│                                              │
│  At least one URL required.                  │
│                                              │
│  [Generate video →]                          │
└──────────────────────────────────────────────┘
```

- All fields optional except at least one URL
- Inline validation on blur (is this a valid profile URL?)
- "Other URL" is a catch-all for personal sites, GitHub profiles, etc.
- No account required for hackathon MVP

### Step 2 — Agent progress

```
┌──────────────────────────────────────────────┐
│  Building your video...                      │
│                                              │
│  ✓  Fetching profiles          0.8s          │
│  ✓  Analysing context          2.1s          │
│  ◌  Writing script...                        │
│  ○  Composing visuals                        │
│  ○  Rendering video                          │
│                                              │
│  Usually takes about 90 seconds.             │
└──────────────────────────────────────────────┘
```

- Each step lights up as it completes with a checkmark and elapsed time
- The current step shows a subtle pulse animation
- No estimated total time on individual steps — only a general "about 90 seconds" message
- If any enrichment URLs failed (e.g. login wall), show a soft warning: "Couldn't access Twitter — continuing with LinkedIn only"

### Step 3 — Script review

```
┌──────────────────────────────────────────────┐
│  Script ready — review before rendering      │
│                                              │
│  "Hey Sarah — I came across your work on     │
│  the Stripe Atlas team and your recent post  │
│  on cross-border payments was spot on.       │
│  I'm building something in that space and   │
│  think you'd have a sharp take on it..."     │
│                                              │
│  Based on: LinkedIn · Twitter (3 posts)     │
│                                              │
│  [Edit script]  [Render video →]             │
└──────────────────────────────────────────────┘
```

- Full script is shown — sender reads before committing credits
- Small attribution line shows which sources were used
- Inline edit mode (simple textarea, not a separate page)
- Word count indicator (200 word limit for avatar delivery)

### Step 4 — Video ready

```
┌──────────────────────────────────────────────┐
│  ✓  Your video is ready                      │
│                                              │
│  [Video player — 16:9]                       │
│                                              │
│  [Copy link]  [Download]  [Open in Melius]   │
│                                              │
│  Generate another →                          │
└──────────────────────────────────────────────┘
```

- Autoplay muted on arrival (user unmutes to watch)
- Three CTAs: copy shareable link, download mp4, open full Melius canvas
- "Generate another" resets to step 1 with fields cleared

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

### Video player
- Native `<video>` element, no third-party player for MVP
- 16:9 aspect ratio
- Poster frame: first frame of video or Melius-generated thumbnail

### Error states
- Inline, not modal
- Always show what failed and what the user can do next
- Example: "Twitter profile couldn't be accessed. [Try adding a LinkedIn URL instead] or [Continue without it]"

---

## Visual direction

**Tone:** Clean, fast, professional. Not playful or over-branded. This is a tool for people who send outreach — they want it to look credible, not cute.

**Colour:** Near-monochrome base (white/off-white background, dark text) with a single accent colour for interactive elements. No gradients. No decorative illustration.

**Typography:** System font stack for body copy. Slight weight variation to create hierarchy — 400 for body, 500 for labels and headings. No custom display fonts for MVP.

**Motion:** Minimal. The progress stepper uses a subtle pulse on the active step. Video autoplay is the only unsolicited motion. No page transitions, no hover animations beyond cursor changes.

**Layout:** Single-column, centred, max-width ~600px. Mobile-first. The flow is linear — no sidebar, no tabs, no navigation for MVP.

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

The batch page (`/batch`) introduces a new flow for multi-profile campaigns:

```
┌──────────────────────────────────────────────┐
│  Batch Campaigns                             │
│                                              │
│  ┌──────────────────────────────────────────┐ │
│  │ Campaigns: 2  Profiles: 14  Done: 8      │ │
│  └──────────────────────────────────────────┘ │
│                                              │
│  [New Campaign →]                             │
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
- Job rows show: name, status icon, video link (if done), retry (if failed), delete button
- Auto-polls every 3s while any job is processing
- Delete shows a confirmation before removing
- Form for creating a new campaign takes a comma-separated list of URLs and a sender brief
- Form shows loading state during submission and error messages inline

## Auth header & account menu

When signed in, the header shows:

```
[Logo]  Studio  Batch  Pricing         [email@example.com ▼]
                                          ┌──────────────┐
                                          │ email@me.com  │
                                          │ Pro plan      │
                                          │ 142 credits   │
                                          │──────────────│
                                          │ Sign out      │
                                          └──────────────┘
```

- Account menu is a simple dropdown triggered on click
- Displays email, plan name, current credit balance
- "Sign out" calls `POST /api/auth/logout`
- When not signed in, the header shows a "Sign in" link
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
- **Recent activity** — unified feed of both share records and batch campaigns, grouped by date, with status icons and action links

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

Shown on first visit to `/dashboard` or `/studio`:

```
┌──────────────────────────┐
│ ━━━━━━━━━━━━━━━━━━━━━━  │
│                          │
│ Paste a social URL       │
│                          │
│ LinkedIn, Twitter, or    │
│ any profile link. Nuncio │
│ enriches public context  │
│ to personalise your      │
│ video.                   │
│                          │
│ Skip              Next → │
└──────────────────────────┘
```

- **3 tips:** Paste URL → Review script → Share link
- **Tracking:** `localStorage` (`nuncio_onboarding_done` key)
- **Dismissible:** close button, "Skip" link, or "Got it" on last step
- **Replayable:** "Show tips" button in account menu
- **Animation:** modal fades in with backdrop blur, steps slide horizontally
- **Progress indicator:** segmented bar at top shows position

---

## Hackathon demo mode (retired)

The pre-filled demo shortcut was removed after the hackathon. The app now runs at full speed
for all users with the live pipeline enabled on every request.