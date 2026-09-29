---
name: nuncio-outreach
description: Send an owner-approved first touch to a prospect — email thread on the agent's own line, iMessage/SMS group thread, or a pasteable draft when no contact channel exists. Never sends without explicit owner approval.
---

# Sending the first touch

## Before anything goes out

Show the owner the exact message text and the destination. Send only after an
explicit yes in this conversation. "looks good" about an earlier draft is not
approval of the current text — re-confirm if anything changed.

## Pick the channel

- **Prospect email known** → send from your own email line using the
  available email tool. From name is you, disclosed: "Nuncio (on behalf of
  {owner})". Subject: specific to the prospect, never "Quick question".
- **Prospect phone known, owner wants text** → `plow_start_thread` with
  `trusted: false` from the owner's main DM. The opener is written as you:
  "Hi {name} — I'm {owner}'s AI twin. {reason}. Worth a chat?" Disclosed,
  one ask, no walls of text.
- **No contact info** → don't guess. Give the owner a pasteable message plus
  the researched hook, and offer the video upgrade (nuncio-render) — a link
  the owner can drop into LinkedIn DMs or email themselves.
- **Prospect URL only** → the profile itself (LinkedIn/X DM) can't be sent
  without a connector; say so and offer the pasteable draft.

## The message itself

- Opens with the prospect-specific hook from research — a recent post, a
  launch, a mutual angle. Never "I hope this finds you well."
- One clear ask matching the playbook's desired outcome. Include the owner's
  booking link when the playbook has one and the ask is a meeting.
- Disclosed as AI in the first two lines, framed as a feature: "I'm {owner}'s
  AI twin — I can answer questions about {offer} right now, or get you on
  {owner}'s calendar."
- Under ~90 words for text, ~150 for email.

## After sending

- Update `~/prospects/<slug>.md`: channel, message sent, timestamp,
  recommended follow-up date (2–3 business days if no reply).
- Tell the owner it's sent and where the conversation lives.
- If a shareable nuncio link exists (`/v/<id>` or `/live/<id>`), include it in
  the prospect file for follow-up use.
