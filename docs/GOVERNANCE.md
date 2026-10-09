# Governance — operator runbook

Nuncio's agent surfaces run behind a policy layer that lives outside the
model: every governed call passes three hooks — access (is this tool
offered), pre (may it run), post (what may come back) — and every decision
lands in an append-only audit trail. This page is the five-minute version
of operating it. Implementation detail lives in `AGENTS.md`.

## The dashboard card

`Dashboard → Needs your attention → Agent approvals`.

- **Pending rows** are consequential calls the agent asked to make —
  renders, checkouts, handoffs — blocked until a human decides.
  `grant auto-delivers to agent` means the requester registered a callback
  and will get the grant automatically when you approve.
- **Approve** mints a single-use grant bound to that exact call. If the
  agent registered a callback, it's delivered on the spot; otherwise copy
  the token — it's shown once — and hand it to the agent, which retries
  with `x-nuncio-approval-grant`.
- **Deny** refuses the call for good. A denied action needs a fresh
  request; a different request body needs a fresh approval.
- **Recent governance events** is the interesting half of the audit trail —
  denies, redactions, approvals, grant events — newest first. Plain
  `allow` traffic is filtered out; silence means everything is within
  policy.

## What the event labels mean

| Label | Meaning |
|-------|---------|
| `denied` | A rule refused the call outright (e.g. denylisted domain, agent-only surface). |
| `redacted` | Post-hook removed content from output — injected directives or contact PII. |
| `needs approval` | Policy required a human for this call. |
| `approval requested` | The agent filed the request you're deciding. |
| `decided` | You (or the ops token) approved or denied it. |
| `grant delivered` | The grant was POSTed to the agent's callback. |
| `grant used` | The agent consumed its single-use grant on the retried call. |
| `grant rejected` | A grant was presented that was wrong, reused, expired, or didn't match the call. Watch for bursts. |

A `grant rejected` streak or a `denied` spike is the anomaly worth
investigating — both land in PostHog as `governance_decision` too.

## The CLI

```bash
npx tsx scripts/governance.ts list                                    # the live policy
npx tsx scripts/governance.ts eval agent.render --subject agent       # dry-run a call
npx tsx scripts/governance.ts add ./rule.json                         # add/replace a rule
npx tsx scripts/governance.ts disable <ruleId>                        # switch a rule off
npx tsx scripts/governance.ts enable <ruleId>                         # switch it back
npx tsx scripts/governance.ts remove <ruleId>                         # delete it
npx tsx scripts/governance.ts sync                                    # pull in new seed rules
npx tsx scripts/governance.ts reset                                   # back to shipped defaults
```

`eval` is the safe way to answer "what would the hook say?" — it reads the
live store and prints the access/pre/post decision without writing anything.

## Common operations

**Go fully autonomous (skip human render approval):**

```bash
npx tsx scripts/governance.ts disable pre.agent-render-needs-approval
npx tsx scripts/governance.ts disable pre.agent-checkout-needs-approval
```

**Block a prospect domain** (scraping or research): add the host to
`NUNCIO_BLOCKED_DOMAINS` in the deploy env — `pre.blocked-prospect-domains*`
rules consume it via `in_env`, no rule edit needed.

**Cap spend per call** — e.g. require approval when an agent action would
cost over 50 estimated credits:

```bash
cat > /tmp/cap.json <<'EOF'
{"id":"pre.agent-credit-cap","hook":"pre","match":{"tool":"agent.*"},
 "conditions":[{"input":"estimatedCredits","operator":"exceeds","value":50}],
 "effect":"require_approval","priority":50,"enabled":true}
EOF
npx tsx scripts/governance.ts add /tmp/cap.json
```

(The route must pass `estimatedCredits` into the pre-hook inputs for the
condition to see it — check `eval` first.)

**Emergency kill switch:** `NUNCIO_GOVERNANCE=off` makes every hook a
pass-through. Incident response only — it disables the denylist and the
sanitizer along with the gates.

## The audit trail

`GET /api/agent/audit` (member session or `NUNCIO_APPROVER_TOKEN`) returns
every hook decision — labels and identifiers only, never request bodies,
prospect URLs, or model output. It's append-only by design; there is no
update path.

## Defaults worth knowing

- Pending approvals expire after `NUNCIO_APPROVAL_TTL_SECONDS` (default 1h).
- Grants are single-use, bound to the exact call, and live
  `NUNCIO_GRANT_TTL_SECONDS` (default 15 min).
- Each workspace caps at `NUNCIO_MAX_PENDING_APPROVALS` (default 20)
  pending requests — identical requests deduplicate onto one row instead
  of flooding.
- The agent token can request and poll status but can never decide;
  decisions need your signed-in account or the ops token.
