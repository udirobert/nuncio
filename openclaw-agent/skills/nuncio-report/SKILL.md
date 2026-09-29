---
name: nuncio-report
description: Publish a real outcome to the agent's Agent Index page — a first touch sent, a reply handled, a meeting booked. Use after genuine accomplishments, one story per outcome.
---

# Reporting to the Agent Index

The image already reports token usage automatically. This skill publishes the
*story* of what was accomplished — the public proof on the agent's Index page.

## Write a story after a real outcome

    # Check existing tags first — reuse them so bars line up across agents
    python3 /opt/plow/agent-index-client.py --agent "$AGENT_ID" --tags

    python3 /opt/plow/agent-index-client.py --agent "$AGENT_ID" \
      --story <slug> \
      --title "<headline of what happened>" \
      --body "<2-4 sentences: the situation, what you did, the result>" \
      --tag "<existing tag>"

Good stories: "Researched a VP and got the first touch approved + sent in
9 minutes", "Handled a pricing objection from the playbook and booked the
call". Real outcomes only — no filler, no spam. One story per outcome.

## If reporting looks broken

    python3 /opt/plow/agent-index-client.py status
    # exit 0 = registered, 3 = needs registration

If a story fails, say so and move on — reporting is never worth blocking real
work.
