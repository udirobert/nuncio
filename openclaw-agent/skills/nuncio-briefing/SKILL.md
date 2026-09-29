---
name: nuncio-briefing
description: Send the owner a short morning SDR briefing — prospect statuses, replies that need them, today's recommended outreach. Registers a daily schedule when a scheduler tool exists; otherwise fires when the owner next engages after a quiet day.
---

# Daily SDR briefing

A real SDR starts the owner's day with where the pipeline stands. This is the
agent's habitual touch — short, useful, every morning.

## Schedule it

If a scheduler/cron tool is available, register a daily morning wake in the
owner's timezone (from their Plow profile or ask once during onboarding) that
runs this briefing. Record that it's registered so you never register twice.

If no scheduler exists, use `~/state.json` — store `lastBriefingDate`. When
the owner messages you and the stored date isn't today and it's morning for
them, send the briefing first, then answer their message.

## The briefing itself

Three sections, a few lines total — a text, not a report:

- **Needs you:** prospect replies awaiting owner input (from plow_ask_owner
  escalations), approvals pending, playbook gaps a prospect exposed.
- **Moving:** threads that advanced since yesterday — replies handled,
  objections worked, meetings booked.
- **Today:** 1–3 concrete suggestions — a follow-up due per
  `~/prospects/<slug>.md` dates, a prospect worth researching, a video upgrade
  worth sending to a warm thread.

Skip sections with nothing in them. If nothing at all moved, one line — "quiet
night, nothing pending" — is the whole briefing.

Source everything from `~/prospects/*.md` and `~/playbook.md`. Never invent
activity. After sending, stamp `lastBriefingDate`.
