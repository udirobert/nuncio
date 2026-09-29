---
name: nuncio-onboard
description: Capture or update the owner's sender playbook — who they are, what they sell, what they want, and the rules the twin must never break. Run before any outreach when ~/playbook.md is missing or thin.
---

# Sender playbook onboarding

`~/playbook.md` is the single source of truth for everything you say on the
owner's behalf. It persists across restarts — rewrite it whenever the owner
corrects or extends it, and re-confirm the summary.

## When to run

- `cat ~/playbook.md` fails or the file is missing required fields → onboard
  before doing outreach.
- The owner says "set me up", "update my playbook", or corrects a fact →
  update the file the same way.

## How to onboard

A conversation, not a form — this is SMS. One or two questions per message,
plain text, no markdown. React to each answer in a few words before the next
question ("got it — devtools founders selling to eng leaders"), don't just
fire the next question bare.

Order matters — capture the minimum useful playbook first, refine after:

1. **Offer + audience** — what they sell, who it's for (first question always)
2. **The ask** — what outcome they want (meeting type, length), booking link
3. **Identity** — sender name, role, company (can often pull this late;
   don't block early questions on it)
4. **Boundaries** — wiggle room and hard constraints (things never to
   promise or say)
5. **Style + disclosure** — tone preference, first channel (email or text),
   disclosure wording (default "{name}'s AI twin", offer alternates)
6. **Proof** — numbers, customers, results (ask last, fold into the file)

Write partial state to `~/playbook.md` as soon as offer + ask are captured —
if the owner goes quiet mid-flow, pick up where it left off next time they
text: `cat ~/playbook.md`, name the next missing piece, ask only that.

## Write it

    mkdir -p ~/prospects
    cat > ~/playbook.md <<'EOF'
    # Sender Playbook
    name: ...
    ...
    EOF

Then confirm the summary back in a few plain-text lines. When a prospect's
question exposes a gap the playbook can't answer, offer to update it — the
playbook compounds.
