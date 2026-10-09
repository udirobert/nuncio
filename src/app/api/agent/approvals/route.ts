/**
 * Governance approvals — the human-in-the-loop half of the control plane.
 *
 * GET  ?id=<approvalId>      agent token: status of its own request
 *                            member session: list workspace approvals
 * POST { id, decision, note? }  member session or ops token: decide
 *
 * Separation of duties is structural: the agent token can read status but
 * can never decide; a member can never be the requester of an agent-class
 * approval. On "approved" the response carries a single-use grant token —
 * shown exactly once, stored only as a hash, bound to (tool, payload).
 */

import { NextRequest, NextResponse } from "next/server";
import { validateAgentRequest } from "@/lib/agent-auth";
import { readAccountSession } from "@/lib/auth/session";
import {
  decideApproval,
  listApprovals,
} from "@/lib/governance/service";
import { getGovernanceStorageProvider } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  // Agent token → status of a single approval it requested. Never the grant.
  const agent = validateAgentRequest(request);
  if (agent.ok) {
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const approval = await getGovernanceStorageProvider().getApproval(id);
    if (!approval) {
      return NextResponse.json({ error: "approval not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: approval.id,
      status: approval.status,
      decidedAt: approval.decidedAt,
      expiresAt: approval.expiresAt,
    });
  }

  // Member session → their workspace's approvals plus the agent surface's —
  // agent requests exist to be decided by the operator.
  const session = readAccountSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = request.nextUrl.searchParams.get("status") || undefined;
  const agentWorkspaceId = process.env.NUNCIO_AGENT_WORKSPACE_ID || "agent";
  const filter = {
    ...(status
      ? { status: status as "pending" | "approved" | "denied" | "consumed" | "expired" }
      : {}),
  };
  const [own, agentSurface] = await Promise.all(
    [...new Set([session.workspaceId, agentWorkspaceId])].map((workspaceId) =>
      listApprovals({ workspaceId, ...filter }),
    ),
  );
  const approvals = [...own, ...agentSurface].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  return NextResponse.json({ approvals });
}

export async function POST(request: NextRequest) {
  let body: { id?: string; decision?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.id || (body.decision !== "approved" && body.decision !== "denied")) {
    return NextResponse.json(
      { error: "id and decision ('approved'|'denied') are required" },
      { status: 400 },
    );
  }

  const result = await decideApproval(request, {
    id: body.id,
    decision: body.decision,
    ...(body.note ? { note: body.note } : {}),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // The grant token crosses the wire exactly once — here — and is then only
  // ever its hash. The requester retries with it in x-nuncio-approval-grant.
  return NextResponse.json({
    id: result.approval.id,
    status: result.approval.status,
    decidedBy: result.approval.decidedBy,
    ...(result.grantToken
      ? {
          grantToken: result.grantToken,
          grantExpiresAt: result.approval.grantExpiresAt,
          grantDelivered: result.grantDelivered ?? false,
          grantUsage:
            "Single use. Present as x-nuncio-approval-grant on the retried call.",
        }
      : {}),
  });
}
