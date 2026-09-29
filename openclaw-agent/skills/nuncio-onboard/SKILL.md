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

A conversation, not a form — two or three questions at a time. Required
fields:

- **Identity:** sender name, role, company
- **Offer:** what they sell, who it's for, proof points (numbers, customers,
  results)
- **The ask:** what outcome they want (meeting type, length), booking link
- **Boundaries:** wiggle room (what can be negotiated) and hard constraints
  (things never to promise or say)
- **Style:** tone preference, preferred first channel (email or text)
- **Disclosure:** the wording they're comfortable with — default is
  "{name}'s AI twin", offer alternates

## Write it

    mkdir -p ~/prospects
    cat > ~/playbook.md <<'EOF'
    # Sender Playbook
    name: ...
    ...
    EOF

Then confirm the summary back to the owner in a few lines. When a prospect's
question exposes a gap the playbook can't answer, offer to update it — the
playbook compounds.
