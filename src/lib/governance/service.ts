/**
 * The governance service — where policy meets the request path.
 *
 * Every governed call takes the same road:
 *
 *   checkAccess(subject, tool)      which tools this caller is offered
 *   checkPre(subject, tool, inputs) may this call run
 *   applyPost(subject, tool, out)   what may come back
 *
 * Each writes one audit row — labels and identifiers only, never payload.
 * Evaluation errors fail closed: a control plane that cannot read its rules
 * denies rather than guesses.
 *
 * Kill switch: NUNCIO_GOVERNANCE=off makes every hook a pass-through. It is
 * for incident response, not a second policy channel.
 */

import crypto from "node:crypto";
import policies from "./policies.json";
import { evaluateAccess, evaluatePost, evaluatePre } from "./engine";
import { sanitizeValue } from "./sanitize";
import { getClientId } from "@/lib/rate-limit";
import { readAccountSession } from "@/lib/auth/session";
import { getGovernanceStorageProvider } from "@/lib/storage";
import type {
  AccessDecision,
  GovernanceApproval,
  GovernanceDecision,
  GovernanceRule,
  GovernanceSubject,
  PostDecision,
  PreDecision,
} from "./types";

const POLICY_POLL_MS = 2000;
const APPROVAL_TTL_SECONDS = Number(process.env.NUNCIO_APPROVAL_TTL_SECONDS || 3600);
const GRANT_TTL_SECONDS = Number(process.env.NUNCIO_GRANT_TTL_SECONDS || 900);

export function governanceEnabled(): boolean {
  return process.env.NUNCIO_GOVERNANCE !== "off";
}

/**
 * Classify the caller. Class — not identity — is what rules key on: agent
 * token → "agent", a signed-in account session → "member", everything else →
 * "anonymous". Token presence alone is not enough: a wrong token still reads
 * as anonymous, never as agent.
 */
export function subjectForRequest(request: Request): GovernanceSubject {
  const expected = process.env.NUNCIO_AGENT_TOKEN;
  if (expected) {
    const token =
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      request.headers.get("x-nuncio-agent-token");
    if (token && token === expected) {
      return {
        class: "agent",
        workspaceId: process.env.NUNCIO_AGENT_WORKSPACE_ID || "agent",
      };
    }
  }

  const session = readAccountSession(request);
  if (session) {
    return { class: "member", workspaceId: session.workspaceId, userId: session.userId };
  }

  return { class: "anonymous", clientId: getClientId(request) };
}

// ── Policy load + seed ────────────────────────────────────────────────

let rulesCache: { rules: GovernanceRule[]; at: number } | null = null;

async function getRules(): Promise<GovernanceRule[]> {
  const now = Date.now();
  if (rulesCache && now - rulesCache.at < POLICY_POLL_MS) return rulesCache.rules;

  const provider = getGovernanceStorageProvider();
  let rules = await provider.listRules();
  if (rules.length === 0) {
    // First boot seeds the shipped policy; after that the store is the
    // policy and this file is only the reset point.
    rules = policies.rules as GovernanceRule[];
    await provider.putRules(rules);
  }
  rulesCache = { rules, at: now };
  return rules;
}

export function invalidateRulesCache(): void {
  rulesCache = null;
}

// ── Audit ─────────────────────────────────────────────────────────────

async function audit(entry: Omit<GovernanceDecision, "id" | "at">): Promise<void> {
  try {
    await getGovernanceStorageProvider().appendDecision({
      ...entry,
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
    });
  } catch (error) {
    // The audit write failing must not break the request path — but it is
    // loud: a governed call with no audit row is a hole in the trail.
    console.error("[governance] audit write failed:", error);
  }
}

// ── The three hooks ───────────────────────────────────────────────────

export async function checkAccess(
  subject: GovernanceSubject,
  tool: string,
): Promise<AccessDecision> {
  if (!governanceEnabled()) return { decision: "allow" };
  const start = Date.now();
  let decision: AccessDecision;
  try {
    decision = evaluateAccess(await getRules(), subject, tool);
  } catch (error) {
    console.error("[governance] access eval failed closed:", error);
    decision = { decision: "deny", reason: "policy evaluation failed" };
  }
  await audit({
    hook: "access",
    tool,
    subjectClass: subject.class,
    workspaceId: subject.workspaceId,
    decision: decision.decision === "deny" ? "deny" : "allow",
    ruleId: decision.ruleId,
    reason: decision.reason,
    latencyMs: Date.now() - start,
  });
  return decision;
}

export async function checkPre(
  subject: GovernanceSubject,
  tool: string,
  inputs: Record<string, unknown> = {},
): Promise<PreDecision> {
  if (!governanceEnabled()) return { decision: "allow" };
  const start = Date.now();
  let decision: PreDecision;
  try {
    decision = evaluatePre(await getRules(), subject, tool, inputs);
  } catch (error) {
    console.error("[governance] pre eval failed closed:", error);
    decision = { decision: "deny", reason: "policy evaluation failed" };
  }
  await audit({
    hook: "pre",
    tool,
    subjectClass: subject.class,
    workspaceId: subject.workspaceId,
    decision:
      decision.decision === "allow"
        ? "allow"
        : decision.decision === "deny"
          ? "deny"
          : "require_approval",
    ruleId: decision.ruleId,
    reason: decision.reason,
    latencyMs: Date.now() - start,
  });
  return decision;
}

/**
 * Post-hook: applies every matching redact rule's patterns to the payload and
 * returns the rewritten value. The caller returns `result.value` — the model
 * and the wire only ever see the post-hook's output.
 */
export async function applyPost<T>(
  subject: GovernanceSubject,
  tool: string,
  payload: T,
  inputs: Record<string, unknown> = {},
): Promise<{ value: T; decision: PostDecision; removed: string[] }> {
  if (!governanceEnabled()) {
    return { value: payload, decision: { decision: "allow", patternIds: [], ruleIds: [] }, removed: [] };
  }
  const start = Date.now();
  try {
    const decision = evaluatePost(await getRules(), subject, tool, inputs);
    const { value, removed } =
      decision.patternIds.length > 0
        ? sanitizeValue(payload, decision.patternIds)
        : { value: payload, removed: [] as string[] };
    await audit({
      hook: "post",
      tool,
      subjectClass: subject.class,
      workspaceId: subject.workspaceId,
      decision: removed.length > 0 ? "redact" : "allow",
      ruleId: decision.ruleIds.join(",") || undefined,
      reason: removed.length > 0 ? `patterns fired: ${removed.join(",")}` : undefined,
      latencyMs: Date.now() - start,
    });
    return { value, decision, removed };
  } catch (error) {
    // Fail closed: better to return nothing than unsanitized content.
    console.error("[governance] post eval failed closed:", error);
    await audit({
      hook: "post",
      tool,
      subjectClass: subject.class,
      workspaceId: subject.workspaceId,
      decision: "deny",
      reason: "policy evaluation failed",
      latencyMs: Date.now() - start,
    });
    throw error;
  }
}

// ── Approvals: human-in-the-loop, itself a governed call ──────────────

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** The payload a grant binds to — reordered keys hash the same call. */
export function hashPayload(tool: string, payload: Record<string, unknown>): string {
  return sha256(`${tool}:${stableStringify(payload)}`);
}

/**
 * An approval callback must be a plain absolute http(s) URL — no credentials,
 * no fragments. Link-local metadata endpoints are refused; everything else is
 * the requester's choice (the grant delivered there is its own credential).
 */
function safeCallbackUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    if (url.username || url.password) return undefined;
    const host = url.hostname.toLowerCase();
    if (host === "169.254.169.254" || host.endsWith(".internal")) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export async function requestApproval(input: {
  subject: GovernanceSubject;
  tool: string;
  payload: Record<string, unknown>;
  summary: string;
  estimatedCredits?: number;
  callbackUrl?: string;
}): Promise<GovernanceApproval> {
  const now = new Date();
  const callbackUrl = safeCallbackUrl(input.callbackUrl);
  const approval: GovernanceApproval = {
    id: crypto.randomUUID(),
    workspaceId: input.subject.workspaceId || "agent",
    tool: input.tool,
    requesterClass: input.subject.class,
    summary: input.summary,
    estimatedCredits: input.estimatedCredits,
    payloadHash: hashPayload(input.tool, input.payload),
    status: "pending",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + APPROVAL_TTL_SECONDS * 1000).toISOString(),
    ...(callbackUrl ? { callbackUrl } : {}),
  };
  await getGovernanceStorageProvider().createApproval(approval);
  await audit({
    hook: "approval",
    tool: input.tool,
    subjectClass: input.subject.class,
    workspaceId: approval.workspaceId,
    decision: "approval_requested",
    approvalId: approval.id,
    latencyMs: 0,
  });
  return approval;
}

export type DecideResult =
  | { ok: true; approval: GovernanceApproval; grantToken?: string; grantDelivered?: boolean }
  | { ok: false; error: string; status: number };

/**
 * Decide a pending approval. A human act: requires a signed-in member session
 * (or the ops fallback `NUNCIO_APPROVER_TOKEN`). The agent subject class can
 * never reach this — the caller type is the route's job, enforced again here
 * structurally: requesters are agents, deciders are members.
 *
 * On approve, the grant token is returned exactly once — only its hash is
 * stored — bound to (tool, payloadHash), single-use, short-lived.
 */
export async function decideApproval(
  request: Request,
  input: { id: string; decision: "approved" | "denied"; note?: string },
): Promise<DecideResult> {
  const provider = getGovernanceStorageProvider();
  const approval = await provider.getApproval(input.id);
  if (!approval) return { ok: false, error: "approval not found", status: 404 };
  if (new Date(approval.expiresAt).getTime() <= Date.now()) {
    return { ok: false, error: "approval expired", status: 410 };
  }

  const session = readAccountSession(request);
  const opsToken = process.env.NUNCIO_APPROVER_TOKEN;
  const headerToken = request.headers.get("x-nuncio-approver-token");
  const decidedBy = session
    ? session.email
    : opsToken && headerToken === opsToken
      ? "ops-token"
      : null;
  if (!decidedBy) {
    return { ok: false, error: "sign in to decide approvals", status: 401 };
  }
  // Same-workspace decisions only, unless the requester is the shared agent
  // surface — those exist to be decided by the operator.
  if (session && approval.requesterClass !== "agent" && approval.workspaceId !== session.workspaceId) {
    return { ok: false, error: "approval belongs to another workspace", status: 403 };
  }

  const next: GovernanceApproval = {
    ...approval,
    status: input.decision,
    decidedBy,
    decidedAt: new Date().toISOString(),
    ...(input.note ? { decisionNote: input.note.slice(0, 500) } : {}),
  };

  let grantToken: string | undefined;
  if (input.decision === "approved") {
    grantToken = crypto.randomBytes(32).toString("base64url");
    next.grantTokenHash = sha256(grantToken);
    next.grantExpiresAt = new Date(Date.now() + GRANT_TTL_SECONDS * 1000).toISOString();
  }

  const stored = await provider.decideApproval(input.id, next);
  if (!stored) return { ok: false, error: "approval already decided", status: 409 };

  await audit({
    hook: "approval",
    tool: approval.tool,
    subjectClass: "member",
    workspaceId: approval.workspaceId,
    decision: "approval_decided",
    ruleId: input.decision,
    approvalId: approval.id,
    latencyMs: 0,
  });

  // If the requester registered a callback, the grant goes straight to it —
  // the human's click is the delivery. The token is still returned to the
  // decider as a fallback if delivery fails.
  let grantDelivered = false;
  if (grantToken && stored.callbackUrl) {
    grantDelivered = await deliverGrant(stored, grantToken);
    await audit({
      hook: "approval",
      tool: approval.tool,
      subjectClass: "member",
      workspaceId: approval.workspaceId,
      decision: "grant_delivered",
      reason: grantDelivered ? undefined : "callback delivery failed",
      approvalId: approval.id,
      latencyMs: 0,
    });
  }

  return {
    ok: true,
    approval: stored,
    ...(grantToken ? { grantToken, grantDelivered } : {}),
  };
}

/** POST the one-time grant to the agent's callback. 3s cap; never throws. */
async function deliverGrant(
  approval: GovernanceApproval,
  grantToken: string,
): Promise<boolean> {
  try {
    const res = await fetch(approval.callbackUrl!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approvalId: approval.id,
        tool: approval.tool,
        grantToken,
        grantExpiresAt: approval.grantExpiresAt,
        usage: "Retry the original call with header x-nuncio-approval-grant",
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      console.error(`[governance] grant callback ${approval.callbackUrl} → HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[governance] grant callback failed:", error);
    return false;
  }
}

export type GrantCheck =
  | { ok: true; approval: GovernanceApproval }
  | { ok: false; error: string };

/**
 * Consume a single-use grant for a retry. Bound to (tool, payloadHash): a
 * grant for one call does not cover a different one. The token is hashed
 * before lookup — the store never holds the bearer.
 */
export async function consumeApprovalGrant(
  grantToken: string,
  tool: string,
  payload: Record<string, unknown>,
): Promise<GrantCheck> {
  const provider = getGovernanceStorageProvider();
  const approval = await provider.getApprovalByGrantHash(sha256(grantToken));

  const base = {
    hook: "grant" as const,
    tool,
    subjectClass: "agent" as const,
    workspaceId: approval?.workspaceId,
    latencyMs: 0,
  };

  if (!approval) {
    await audit({ ...base, decision: "grant_rejected", reason: "unknown grant" });
    return { ok: false, error: "unknown grant" };
  }
  if (approval.tool !== tool || approval.payloadHash !== hashPayload(tool, payload)) {
    await audit({ ...base, decision: "grant_rejected", approvalId: approval.id, reason: "grant does not cover this call" });
    return { ok: false, error: "grant does not cover this call" };
  }

  const consumed = await provider.consumeGrant(approval.id);
  if (!consumed) {
    await audit({ ...base, decision: "grant_rejected", approvalId: approval.id, reason: "grant not usable (unapproved, consumed, or expired)" });
    return { ok: false, error: "grant not usable" };
  }
  await audit({ ...base, decision: "grant_consumed", approvalId: approval.id });
  return { ok: true, approval: consumed };
}

export async function listApprovals(input: {
  workspaceId: string;
  status?: GovernanceApproval["status"];
  limit?: number;
}) {
  return getGovernanceStorageProvider().listApprovals(input);
}

export async function listDecisions(input: { workspaceId?: string; limit?: number }) {
  return getGovernanceStorageProvider().listDecisions(input);
}
