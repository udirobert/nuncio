# End-to-end verification runbook

**Status: never run.** The live path (a stranger opening a link and talking to
the sender's AI representative) has never been verified in a real browser with
a real second person. Headless browsers cannot pass the microphone gate, so
this cannot be automated end to end — it needs a human on both sides.

Everything else in this repo is downstream of whether this works. Run it
before changing anything else about the live path.

## Why it matters

The product's promise is one sentence: *a link turns into a conversation, and
a conversation turns into a meeting.* Every funnel metric, every scoring
decision and every piece of onboarding copy assumes that sentence holds. If
the prospect never gets an answer, none of the rest matters.

## What you need

- Two people: the **sender** (you, on the owner account) and the **recipient**
  (a second device, ideally a phone on mobile data — not the same wifi).
- A workspace with: a playbook, a live avatar configured, and a scheduling
  link. If the workspace has no avatar, the run stops at step 3 — that itself
  is a finding.
- The app deployed (`https://nuncio.persidian.com`) or running locally on both
  devices.

## The run

### 1. The sender prepares

1. Sign in, open **Your representative** (`/setup`).
2. Fill the playbook: what you want, what you offer, what it must never
   promise. Save.
3. Fill the trust proof: photo, company logo, and the one line about what
   your representative can answer. Save.
4. Add a scheduling link (Calendly or Cal.com). Save.
5. Confirm the **Status** list shows identity, playbook and live avatar as
   set. *If the live avatar is not set, stop and report it — the rest of the
   run cannot proceed.*

### 2. The sender creates the first touch

6. Open **Create** (`/studio`), paste the recipient's public profile URL, and
   a one-line brief. Press **Research & write the opening**.
7. Review the script. It must name the recipient and reference something
   specific from their profile. If it reads generically, the research
   failed — note it and continue.
8. Press **Copy link**. Send the link to the recipient yourself (email, text —
   your choice; the app does not send it yet).

### 3. The recipient opens the link — **the critical step**

9. On the second device, open the link.
10. The page must show: the sender's **name**, their **photo**, their
    **company logo**, the "Disclosed, never disguised" line, and the
    one-liner about what the representative can answer.
11. Click **Ask the AI representative**.
12. The lobby must offer **Check mic**. Accept the microphone permission.
    *If the mic cannot be granted, that is a finding — stop and report it.*
13. The AI representative must speak. Ask it something specific to the
    playbook: *"What can you tell me about your offer?"* and *"What can't you
    promise?"*
    - The answer must come from the playbook.
    - It must refuse to quote pricing if the playbook says never promise
      pricing.
    - It must disclose that it is an AI representative.
14. Ask *"Can I talk to {sender}?"* and check that the request option appears
    and that the sender's dashboard shows a pending request.

### 4. The sender takes over — **the second critical step**

15. On the owner device, the Inbox must show a **Call requests** card with the
    request from the recipient.
16. Press **Accept**, then **Join call**. Both sides must be in the same
    room, with two-way audio. *The AI must step aside.*
17. Talk for a minute. Hang up.
18. Both rooms must close cleanly — no stuck "connected" state, no credit
    leak (check the credit balance before and after).

### 5. The booking

19. On the recipient device, ask the representative to book a time, or use
    **Choose a time** on the link.
20. The booking must appear on the sender's dashboard under **Bookings**, and
    the sender's scoreboard must show **Meetings booked** incremented.

## What to record

For each step, note **pass** or **fail** and, for a failure, the exact
behaviour. The failure modes worth capturing precisely:

- Which step broke (3, 4 and 5 are the ones that have never been verified).
- Whether the mic gate passed and which browser/OS.
- Whether the AI answered from the playbook or improvised.
- Whether both sides could hear each other in step 16.
- The credit balance before and after the session (a leak is a bug, not a
  rounding error).
- Any console error, with the exact message.

## After the run

- File the findings in `docs/TESTING.md` under this section, replacing
  "never run" with the outcome.
- Any defect found here outranks every feature in the backlog. Fix it before
  adding surface area.

## What is already covered by automation

These parts of the same journey are covered by tests and do not need a human:

- The view beacon (a recipient opening a link) — `src/app/api/share/[id]/view/route.test.ts`.
- The relationship state derived from it — `src/lib/inbox.test.ts`.
- Reply-to-live escalation — `src/app/api/agent/live-invite/route.test.ts`.
- Batch authorization — `src/app/api/batch/route.test.ts`.
