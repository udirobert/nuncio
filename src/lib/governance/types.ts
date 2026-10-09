/**
 * Governance control plane — types.
 *
 * Ported from the MCP4GTM pattern (ArcadeAI/mastra-elastic-gtm-governance):
 * controls an agent cannot reason around live outside it. Three hooks run on
 * every governed call — access (which tools are offered), pre (may this call
 * run), post (what may come back) — and every decision lands in an append-only
 * audit log. Rules are data in the governance store, seeded from policies.json
 * when empty; the caller's authority comes from its subject class, never from
 * the model.
 */

export type GovernanceHook = "access" | "pre" | "post";

/** Who the call is for — class, not identity, is what rules key on. */
export type SubjectClass = "anonymous" | "member" | "agent";

export interface GovernanceSubject {
  class: SubjectClass;
  /** Workspace the call is billed to / owned by, when known. */
  workspaceId?: string;
  userId?: string;
  /** Rate-limit client id — the only handle anonymous callers have. */
  clientId?: string;
}

export type GovernanceOperator =
  | "eq"
  | "neq"
  | "exists"
  | "exceeds"
  | "in"
  | "in_env" // value is an env var name; input must appear in its comma-separated list
  | "contains";

export interface RuleCondition {
  /** Dotted path into the call's inputs, e.g. "amount" or "request.url". */
  input: string;
  operator: GovernanceOperator;
  value?: unknown;
}

export type GovernanceEffect = "allow" | "deny" | "redact" | "require_approval";

export interface GovernanceRule {
  id: string;
  description?: string;
  hook: GovernanceHook;
  /** Exact tool name, "*" for all, or a prefix ending in ".*" (e.g. "agent.*"). */
  match: { tool: string };
  /** Subject classes the rule applies to. Absent = everyone. */
  subjectClasses?: SubjectClass[];
  conditions?: RuleCondition[];
  effect: GovernanceEffect;
  /**
   * Denial/escalation text shown to the caller — and to the model when the
   * caller is one. A denial that should drive a retry names how here; the
   * prompt never does.
   */
  reason?: string;
  /** Post-hook only: named pattern sets from sanitize.ts to apply to output. */
  redact?: { patterns: string[] };
  /** Higher priority wins when rules disagree; evaluation is deny-over-allow. */
  priority: number;
  enabled: boolean;
}

/** Tools as the rules see them — routes and pipeline steps, not an MCP registry. */
export type GovernedTool =
  | "mcp.research_and_draft"
  | "agent.lite"
  | "agent.prospect-queue"
  | "agent.render" // the render step inside prospect-queue — approval-gated
  | "agent.earn-checkout"
  | "agent.handoffs"
  | "agent.call-requests"
  | "agent.reply-webhook"
  | "pipeline.research" // virtual: prospect-controlled text entering the model
  | (string & {});

export type PreDecisionKind = "allow" | "deny" | "require_approval";

export interface AccessDecision {
  decision: "allow" | "deny";
  ruleId?: string;
  reason?: string;
}

export interface PreDecision {
  decision: PreDecisionKind;
  ruleId?: string;
  reason?: string;
}

export interface PostDecision {
  decision: "allow" | "redact";
  /** Pattern ids to run over the output, in rule order. */
  patternIds: string[];
  /** Rules that contributed, for the audit row. */
  ruleIds: string[];
}

export type AuditDecisionKind =
  | "allow"
  | "deny"
  | "redact"
  | "require_approval"
  | "approval_requested"
  | "approval_decided"
  | "grant_delivered"
  | "grant_consumed"
  | "grant_rejected";

/**
 * One row per hook decision. Labels and identifiers only — never inputs,
 * outputs, prospect URLs, or message text. Same usage-only rule as
 * analytics-server.
 */
export interface GovernanceDecision {
  id: string;
  at: string;
  hook: GovernanceHook | "approval" | "grant";
  tool: string;
  subjectClass: SubjectClass;
  workspaceId?: string;
  decision: AuditDecisionKind;
  ruleId?: string;
  /** Denial text is recorded; it is policy, not payload. */
  reason?: string;
  approvalId?: string;
  latencyMs: number;
}

export type ApprovalStatus = "pending" | "approved" | "denied" | "consumed" | "expired";

/**
 * A human-in-the-loop approval for a consequential governed call. The
 * requester holds nothing but the id; the grant token is returned once, on
 * approve, and is single-use and bound to (tool, payloadHash).
 */
export interface GovernanceApproval {
  id: string;
  workspaceId: string;
  tool: string;
  requesterClass: SubjectClass;
  /** What is being asked — e.g. "render video for prospect X" summary + credits. */
  summary: string;
  estimatedCredits?: number;
  /** sha256 of {tool, canonical payload} — the grant only covers this call. */
  payloadHash: string;
  status: ApprovalStatus;
  createdAt: string;
  expiresAt: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  /**
   * Optional agent-supplied webhook (x-nuncio-approval-callback). On approve
   * the grant token is POSTed here — so a human click delivers straight back
   * to the agent instead of a copy-paste round trip. The grant is the agent's
   * own credential, so an agent-chosen URL can only leak it to itself.
   */
  callbackUrl?: string;
  /** Stored hashed; the bearer is returned once at decision time. */
  grantTokenHash?: string;
  grantExpiresAt?: string;
}
