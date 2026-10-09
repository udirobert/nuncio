/**
 * Governance audit trail — every access/pre/post decision, approval and
 * grant event, labels only. Member session → their workspace's rows; the
 * ops token → everything. The agent token is deliberately not a reader:
 * the surface being audited does not get to browse the audit.
 */

import { NextRequest, NextResponse } from "next/server";
import { readAccountSession } from "@/lib/auth/session";
import { listDecisions } from "@/lib/governance/service";

export const runtime = "nodejs";

const MAX_LIMIT = 500;

export async function GET(request: NextRequest) {
  const limit = Math.min(
    Number(request.nextUrl.searchParams.get("limit")) || 100,
    MAX_LIMIT,
  );

  const opsToken = process.env.NUNCIO_APPROVER_TOKEN;
  const headerToken = request.headers.get("x-nuncio-approver-token");
  if (opsToken && headerToken === opsToken) {
    return NextResponse.json({ decisions: await listDecisions({ limit }) });
  }

  const session = readAccountSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Their workspace plus the agent surface — the operator audits both.
  const agentWorkspaceId = process.env.NUNCIO_AGENT_WORKSPACE_ID || "agent";
  const rows = await Promise.all(
    [...new Set([session.workspaceId, agentWorkspaceId])].map((workspaceId) =>
      listDecisions({ workspaceId, limit }),
    ),
  );
  const decisions = rows
    .flat()
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
  return NextResponse.json({ decisions });
}
