# Studio Intuitiveness Plan (5→8)

## Problem

The studio page front-loads too many concepts at once:
- 6 archetype options with unexplained creative jargon (Mirror, Origin, Future-cast...)
- "Built on Melius" branding that means nothing to new users
- Melius connect UI (optional but always visible)
- Ambient canvas animation (decorative but adds visual noise)
- "How the agent works" 4-column grid below the fold

The review stage shows 3 editable panels simultaneously. The ready stage has 15+ clickable elements.

## Solution: Quick / Advanced mode

A toggle at the top of the studio page switches between two modes. Default is **Quick**.

### Quick mode (the default)

**Input stage** — stripped down to essentials:

```
┌──────────────────────────────────────────────┐
│ [Badge: AI-powered · personalised video]      │
│                                                │
│ Brief an agent.                                │
│ Get a personalised video.                      │
│                                                │
│ Profile URL  [_________________________]      │
│ Your name    [_________________________]      │
│ Context      [_________________________]      │
│              (optional — what's this for?)     │
│                                                │
│ [Generate video →]                             │
│                                                │
│ [Switch to Advanced mode]                      │
└──────────────────────────────────────────────┘
```

Changes from current:
- **Remove** "Built on Melius · agent-orchestrated" badge → replace with generic "AI-powered"
- **Remove** archetype selector entirely (defaults to `auto`)
- **Remove** Melius connect section
- **Remove** right-column `AmbientCanvasLoop`
- **Remove** "How the agent works" section
- **Rename** "Hook archetype" label → nothing, just omit
- **Rename** "Brief" helper text from "the agent uses it" → "what's this for?"
- **Rename** "Research profile" button → "Generate video"
- Add "Switch to Advanced mode" text link below the CTA

**Review stage** — consolidated single-panel view:

```
┌──────────────────────────────────────────────┐
│ [Back]                    [Switch to Advanced]│
│                                                │
│ Script for [Name]                              │
│                                                │
│ ┌────────────────────────────────────────────┐│
│ │ "Hey [Name] — I came across your work...  ││
│ │                                          ││
│ │ [Edit]                     Word count: 142 ││
│ └────────────────────────────────────────────┘│
│                                                │
│ [Generate video →]                             │
└──────────────────────────────────────────────┘
```

Changes from current:
- **Remove** profile editor section (3 inputs, chips, tone toggles) — replaced by a single "Edit" button that opens an inline editor for the whole profile+script
- **Remove** hook info section (archetype badge, format string, reasoning)
- **Remove** agent trace proof
- **Consolidate** action buttons to just: Back, Generate video
- Add "Switch to Advanced" link

**Building stage** — simplified progress:

```
┌──────────────────────────────────────────────┐
│ Generating your video...                      │
│                                                │
│ ✓ Reading profile                             │
│ ✓ Writing script                              │
── ◌ Building creative [▼ Show details]          │
│ ○ Rendering video                              │
│                                                │
│ About 90 seconds...                            │
└──────────────────────────────────────────────┘
```

Changes from current:
- **Replace** agent log terminal with a simple progress stepper (like the home pipeline)
- **Remove** animated `AgentCanvas`
- **Remove** "agent.log · mcp tool calls" panel
- Add "Show details" expandable section for power users who want to see the log

**Ready stage** — focused on the output:

```
┌──────────────────────────────────────────────┐
│ ✓ Your video is ready                         │
│                                                │
│ [Video player — generated cinematic]          │
│                                                │
│ [Copy link]  [Download]  [Share]              │
│                                                │
│ ┌──────────────────────────────────────────┐  │
│ │ Script for [Name]                        │  │
│ │ "Hey [Name] — I came across your work…"  │  │
│ └──────────────────────────────────────────┘  │
│                                                │
│ [Generate another]    [Show advanced options]  │
└──────────────────────────────────────────────┘
```

Changes from current:
- **Remove** "CREATIVE READY" gradient card with all the action buttons
- **Remove** Export ZIP button (too technical)
- **Remove** Audio memo button (confusing, duplicates TTS)
- **Remove** "Open in Melius" link
- **Remove** "Customize avatar & voice" panel
- **Remove** hook reasoning panel
- **Remove** context nodes section
- **Remove** agent trace / creative proof
- **Consolidate** to 3 primary actions: Copy link, Download, Share
- Show script below the video
- "Show advanced options" expands to reveal: avatar customization, ZIP export, audio memo, Melius link

### Advanced mode

The current studio page, plus:
- **Archetype selector gets inline descriptions**: When you hover/select an archetype, a short explanation appears below (e.g. "Mirror — reflect the recipient's own content back at them")
- **"Built on Melius" badge** restored
- **Ambient canvas animation** restored
- **Melius connect** restored
- **Agent log terminal** in building stage
- **Full ready stage** with all actions
- **Profile editor** with all fields in review stage

A "Switch to Quick mode" link is visible at the top.

## Implementation

### Files to modify

| File | Change |
|---|---|
| `src/app/studio/studio-client.tsx` | Add `quickMode` state, conditionally render sections |
| (new) `src/app/studio/quick-input.tsx` | Simplified input form for quick mode |
| (new) `src/app/studio/quick-review.tsx` | Consolidated review panel |
| (new) `src/app/studio/quick-progress.tsx` | Simple progress stepper for building stage |
| (new) `src/app/studio/quick-ready.tsx` | Simplified ready/done view |
| `src/app/studio/studio-client.tsx` | Add archetype descriptions in advanced mode |
| `docs/DESIGN.md` | Add quick/advanced mode to UX documentation |
| `docs/ROADMAP.md` | Update intuitiveness score to 7/10 |

### Approach

The quick mode renders different sub-components instead of the current inline JSX. This keeps the file manageable.

```typescript
// studio-client.tsx
const [quickMode, setQuickMode] = useState(true);

// In the render tree:
{stage === "input" && (
  quickMode ? <QuickInput ... /> : <AdvancedInput ... />
)}
{stage === "review" && (
  quickMode ? <QuickReview ... /> : <AdvancedReview ... />
)}
// etc.
```

Each sub-component gets only the props it needs, reducing re-render complexity. The mode toggle persists in `localStorage` (`nuncio_studio_mode`).

### Effort

| Component | Lines | Est. time |
|---|---|---|
| QuickInput | ~80 | 30 min |
| QuickReview | ~100 | 30 min |
| QuickProgress | ~60 | 20 min |
| QuickReady | ~120 | 40 min |
| Studio client wiring (mode toggle, conditional rendering) | ~50 | 20 min |
| Archetype descriptions | ~20 | 10 min |
| **Total** | **~430 new** | **~2.5 hours** |

### Verification

1. Visit `/studio` → see quick mode by default → only URL, name, brief fields + "Generate video" button
2. Click "Generate video" → see simplified progress stepper
3. Reach review → see consolidated script view with edit button
4. Render → see simplified ready stage with 3 actions
5. Click "Switch to Advanced mode" → see all current studio complexity restored
6. Archetype selector shows descriptions on hover/select
7. Mode persists across page reloads (localStorage)
8. Home pipeline is untouched — `/?` remains as the simplest possible path
