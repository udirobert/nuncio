# Design & UX Improvement Plan

## Goals
- **Design: 7 → 8/10** — Bridge the disjoint Studio/Batch experiences with a unifying dashboard
- **UI/UX: 6 → 8/10** — Add account dashboard with credit history, usage stats, recent videos; add onboarding for new users

---

## Phase 1 — Account Dashboard (`/dashboard`)

**Core idea:** A post-login landing page that unifies Studio and Batch, shows account state, and provides quick access to everything.

### Components (new files)

| File | Purpose |
|---|---|
| `src/app/dashboard/page.tsx` | Server component — reads session, fetches data |
| `src/app/dashboard/dashboard-client.tsx` | Client component — renders all dashboard sections |
| `src/app/dashboard/components/credit-card.tsx` | Balance card + mini transaction list |
| `src/app/dashboard/components/recent-videos.tsx` | Grid of recent videos from this workspace |
| `src/app/dashboard/components/quick-actions.tsx` | Studio, Batch, Pricing CTAs |
| `src/app/dashboard/components/usage-summary.tsx` | Vids this month, credits used, etc. |

### API changes

| Change | Why |
|---|---|
| Add `GET /api/dashboard` | Returns combined data: balance, transactions, recent videos, usage stats in one round-trip |
| Add `GET /api/videos/recent?workspaceId=X` | Lists recent share records filtered by workspace (or email) |
| Add `workspaceId` to `ShareRecord` schema | Needed to filter videos by workspace in storage queries |

### Navigation changes

- Add "Dashboard" link to header nav (shown always, like Pricing/Batch)
- Set `href="/"` redirect to `/dashboard` when user is signed in (or just make Dashboard the post-login page via the account menu)
- Add "Dashboard" link to the AccountMenu dropdown (between credits and "Buy credits")

### Data sources per section

| Section | Source |
|---|---|
| Credit balance | `GET /api/billing/balance` (already exists) |
| Transaction history | `transactions` field from balance endpoint (already returned, just not rendered) |
| Recent videos | New `GET /api/videos/recent` or extend share store with workspaceId filtering |
| Batch campaigns | `GET /api/batch` (already exists) |
| Plan & billing | `GET /api/account/session` (already exists) |

### Visual layout (mockup)

```
┌─────────────────────────────────────────────────────────────┐
│  Welcome back, sarah@example.com                  Pro plan  │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Credits       │  │ This month   │  │ Quick actions     │  │
│  │    142        │  │ 8 videos     │  │ [Studio] [Batch]  │  │
│  │  $39/mo · Pro │  │ 88 used      │  │ [Pricing]         │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  Recent activity                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Today                                                     ││
│  │ • Alice Chen — Batch campaign     ✓ 3/5  [View]         ││
│  │ • Bob Park — Studio video         ✓       [View]         ││
│  │ • Carol Smith — Batch campaign    ✗       [Retry]        ││
│  │ Yesterday                                                 ││
│  │ • David Kim — Studio video        ✓       [View]         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Recent transactions                                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ May 20   Grant       +200  Pro monthly credits          ││
│  │ May 20   Debit        -11  Video: Alice Chen            ││
│  │ May 19   Debit        -11  Video: Bob Park              ││
│  │ May 18   Purchase     +100  Credit pack                 ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 2 — Onboarding Walkthrough

**Goal:** First-time users get 3-4 quick tips when they visit the studio or home page.

### Implementation
- A lightweight first-visit overlay centered on the page (not a multi-step tour tooltip)
- Shows 3 tips with a "Next" / "Got it" flow
- Key tips:
  1. "Paste a LinkedIn, Twitter, or any URL to get started"
  2. "Review the script before rendering — edit it if needed"
  3. "Share the video link with your recipient"
- Tracks completion in `localStorage` keyed as `nuncio_onboarding_done`
- Dismissible with a close button
- Replayable from the account menu ("Show tips again")

### Components

| File | Purpose |
|---|---|
| `src/components/onboarding-modal.tsx` | Modal overlay with step-by-step tips |
| `src/components/onboarding-provider.tsx` | Context that checks localStorage, provides show/hide |

### Integration points
- Import `OnboardingProvider` in root layout
- Render `OnboardingModal` on pages where it should appear (`/studio`, `/`)
- Only shows for new anonymous or newly-signed-up users

---

## Phase 3 — Polish & Cross-linking

**Goal:** Make the two experiences feel connected and discoverable.

### Changes
- **Batch page**: Add a "or create a personalised video in Studio" link referencing `/studio`
- **Studio page**: Add "Need to reach multiple people? Try Batch →" link in the footer or header context
- **AccountMenu**: Add "Dashboard" link at the top of the authenticated dropdown
- **Header**: Add "Dashboard" to the nav links when screen is md+
- **`/` redirect**: Root page (`/`) stays as the landing/marketing page for unauthenticated users; the Dashboard becomes the post-login destination

---

## Data model change

### Add `workspaceId` to `ShareRecord`

```typescript
interface ShareRecord {
  // existing fields…
  workspaceId?: string;  // NEW — ties video to workspace for dashboard queries
}
```

This requires:
1. Update `ShareRecord` type in `src/lib/artifacts.ts`
2. Pass `workspaceId` when creating share records in studio and batch pipelines
3. Add `workspaceId` filter to `ShareStorageProvider.list()` and Turso implementation
4. Add `GET /api/videos/recent?workspaceId=X` endpoint

---

## Files to modify

| File | Change |
|---|---|
| `src/lib/artifacts.ts` | Add `workspaceId` to `ShareRecord` |
| `src/lib/storage/types.ts` | Add `workspaceId` filter to `list()` options |
| `src/lib/storage/turso-share-provider.ts` | Implement workspaceId filter in SQL query |
| `src/lib/storage/file-share-provider.ts` | Implement workspaceId filter in array filter |
| New: `src/app/api/videos/recent/route.ts` | GET handler, queries shares by workspaceId |
| New: `src/app/dashboard/page.tsx` | Server component |
| New: `src/app/dashboard/dashboard-client.tsx` | Client renderer |
| New: `src/app/dashboard/components/credit-card.tsx` | Balance + transactions |
| New: `src/app/dashboard/components/recent-videos.tsx` | Recent videos + batch activity |
| New: `src/app/dashboard/components/quick-actions.tsx` | Action buttons |
| New: `src/app/dashboard/components/usage-summary.tsx` | Usage stats |
| New: `src/components/onboarding-modal.tsx` | First-visit tips |
| `src/components/account-menu.tsx` | Add "Dashboard" link |
| `src/components/header.tsx` | Add "Dashboard" nav link |
| `src/app/layout.tsx` | Add `OnboardingProvider` wrapper |
| Various pipeline files | Pass `workspaceId` when creating `ShareRecord` |

---

## Effort estimate

| Phase | Files | Complexity | Est. time |
|---|---|---|---|
| Phase 1 — Dashboard | ~7 new, ~4 modified | Medium | 4-6 hours |
| Phase 2 — Onboarding | ~1-2 new, ~2 modified | Low | 1-2 hours |
| Phase 3 — Polish | ~4 modified | Low | 1 hour |
| **Total** | **~8 new, ~10 modified** | | **6-9 hours** |

---

## Verification

1. **Dashboard**: Visit `/dashboard` signed in → shows balance, recent videos, transactions, quick actions
2. **Recent videos**: Generate a video in Studio → appears in dashboard recent list
3. **Batch cross-link**: Run a batch → batch campaigns appear in dashboard
4. **Onboarding**: Clear `localStorage` → visit `/studio` → modal appears with tips → dismiss → does not reappear
5. **Navigation**: Dashboard link in header, account menu has "Dashboard" at top
6. **Responsive**: Dashboard layout stacks on mobile (cards → stacked, activity → single column)
7. **Transactions**: Credit transactions from `/api/billing/balance` render in the transaction list
