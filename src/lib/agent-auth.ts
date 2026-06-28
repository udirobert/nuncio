/**
 * Agent API authentication — validates NUNCIO_AGENT_TOKEN header
 * and resolves to a CreditSubject for billing integration.
 *
 * Single source of truth for agent API auth. All /api/agent/* routes
 * use validateAgentRequest() to authenticate.
 */

import type { CreditSubject } from "@/lib/billing/credits";

export interface AgentAuthResult {
  ok: true;
  subject: CreditSubject;
  workspaceId: string;
}

export interface AgentAuthError {
  ok: false;
  error: string;
  status: number;
}

/**
 * Validates the agent token from the Authorization header or
 * x-nuncio-agent-token header. Resolves to a CreditSubject tied
 * to the workspace configured for the agent.
 *
 * Env vars:
 *   NUNCIO_AGENT_TOKEN  — required shared secret
 *   NUNCIO_AGENT_WORKSPACE_ID — workspace to bill (defaults to "agent")
 */
export function validateAgentRequest(request: Request): AgentAuthResult | AgentAuthError {
  const expectedToken = process.env.NUNCIO_AGENT_TOKEN;
  if (!expectedToken) {
    return {
      ok: false,
      error: "Agent API not configured — set NUNCIO_AGENT_TOKEN",
      status: 503,
    };
  }

  const token =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    request.headers.get("x-nuncio-agent-token");

  if (!token || token !== expectedToken) {
    return { ok: false, error: "Invalid agent token", status: 401 };
  }

  const workspaceId = process.env.NUNCIO_AGENT_WORKSPACE_ID || "agent";

  return {
    ok: true,
    subject: { workspaceId, anonymous: false },
    workspaceId,
  };
}
