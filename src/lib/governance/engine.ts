/**
 * The policy evaluator — pure, no I/O, no model.
 *
 * Rules are data. Evaluation order: matching rules sorted by priority
 * descending; `deny` and `require_approval` always beat `allow` (an allow rule
 * is the absence of a denial, never an override). A rule that matches nothing
 * is indistinguishable from a rule that permits — tests pin every seeded rule
 * to a case it must fire on.
 */

import type {
  AccessDecision,
  GovernanceRule,
  GovernanceSubject,
  PostDecision,
  PreDecision,
  RuleCondition,
} from "./types";

function toolMatches(pattern: string, tool: string): boolean {
  if (pattern === "*" || pattern === tool) return true;
  if (pattern.endsWith(".*")) return tool.startsWith(pattern.slice(0, -1));
  return false;
}

function subjectMatches(rule: GovernanceRule, subject: GovernanceSubject): boolean {
  return !rule.subjectClasses || rule.subjectClasses.includes(subject.class);
}

function readPath(inputs: Record<string, unknown>, path: string): unknown {
  let cur: unknown = inputs;
  for (const part of path.split(".")) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function conditionHolds(cond: RuleCondition, inputs: Record<string, unknown>): boolean {
  const value = readPath(inputs, cond.input);
  switch (cond.operator) {
    case "eq":
      return value === cond.value;
    case "neq":
      return value !== cond.value;
    case "exists":
      return cond.value === false ? value === undefined : value !== undefined;
    case "exceeds":
      return typeof value === "number" && typeof cond.value === "number" && value > cond.value;
    case "in":
      return Array.isArray(cond.value) && cond.value.includes(value);
    case "in_env": {
      const envName = typeof cond.value === "string" ? cond.value : "";
      const list = (process.env[envName] || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      return typeof value === "string" && list.includes(value.toLowerCase());
    }
    case "contains":
      return typeof value === "string" && typeof cond.value === "string" &&
        value.toLowerCase().includes(cond.value.toLowerCase());
    default:
      return false;
  }
}

/** Rules for (hook, subject, tool) with all conditions satisfied, priority-sorted. */
function matchingRules(
  rules: GovernanceRule[],
  hook: GovernanceRule["hook"],
  subject: GovernanceSubject,
  tool: string,
  inputs: Record<string, unknown>,
): GovernanceRule[] {
  return rules
    .filter(
      (r) =>
        r.enabled &&
        r.hook === hook &&
        toolMatches(r.match.tool, tool) &&
        subjectMatches(r, subject) &&
        (r.conditions ?? []).every((c) => conditionHolds(c, inputs)),
    )
    .sort((a, b) => b.priority - a.priority);
}

export function evaluateAccess(
  rules: GovernanceRule[],
  subject: GovernanceSubject,
  tool: string,
): AccessDecision {
  const hits = matchingRules(rules, "access", subject, tool, { tool });
  const deny = hits.find((r) => r.effect === "deny");
  if (deny) return { decision: "deny", ruleId: deny.id, reason: deny.reason };
  return { decision: "allow" };
}

/**
 * Deny wins over require_approval wins over allow — a rule that says "this
 * call may not run at all" must not be softened into "it may run if a human
 * clicks yes".
 */
export function evaluatePre(
  rules: GovernanceRule[],
  subject: GovernanceSubject,
  tool: string,
  inputs: Record<string, unknown> = {},
): PreDecision {
  const hits = matchingRules(rules, "pre", subject, tool, inputs);
  const deny = hits.find((r) => r.effect === "deny");
  if (deny) return { decision: "deny", ruleId: deny.id, reason: deny.reason };
  const approval = hits.find((r) => r.effect === "require_approval");
  if (approval) return { decision: "require_approval", ruleId: approval.id, reason: approval.reason };
  return { decision: "allow" };
}

/** Post rules accumulate — every matching redact rule contributes its patterns. */
export function evaluatePost(
  rules: GovernanceRule[],
  subject: GovernanceSubject,
  tool: string,
  inputs: Record<string, unknown> = {},
): PostDecision {
  const hits = matchingRules(rules, "post", subject, tool, inputs).filter(
    (r) => r.effect === "redact",
  );
  return {
    decision: hits.length ? "redact" : "allow",
    patternIds: hits.flatMap((r) => r.redact?.patterns ?? []),
    ruleIds: hits.map((r) => r.id),
  };
}
