import { NextRequest, NextResponse } from "next/server";
import { validateAgentRequest } from "@/lib/agent-auth";
import { getCallRequestStorageProvider, getHandoffStorageProvider } from "@/lib/storage";
import { getShareRecord } from "@/lib/share-store";
import { absoluteUrl } from "@/lib/url";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const auth = validateAgentRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  if (!process.env.NUNCIO_AGENT_WORKSPACE_ID) {
    return NextResponse.json({ error: "NUNCIO_AGENT_WORKSPACE_ID is required" }, { status: 503, headers: NO_STORE });
  }

  const callRequests = await getCallRequestStorageProvider().listByWorkspace(auth.workspaceId, 50);

  const items = await Promise.all(callRequests.map(async (callRecord) => {
    const share = await getShareRecord(callRecord.shareId);
    const scopedShare = share && share.workspaceId === auth.workspaceId ? share : null;
    let context = null;
    if (scopedShare?.handoffId) {
      const handoff = await getHandoffStorageProvider().get(scopedShare.handoffId);
      if (
        handoff
        && handoff.id === scopedShare.handoffId
        && handoff.shareId === scopedShare.id
        && handoff.workspaceId === auth.workspaceId
      ) {
        context = handoff.context;
      }
    }
    return {
      requestId: callRecord.id,
      shareId: callRecord.shareId,
      status: callRecord.status,
      createdAt: callRecord.createdAt,
      expiresAt: callRecord.expiresAt,
      recipientName: scopedShare?.recipientName ?? null,
      context,
      dashboardUrl: absoluteUrl("/dashboard", request),
    };
  }));

  return NextResponse.json(
    { callRequests: items, scope: "latest 50 call requests in this workspace", push: false },
    { headers: NO_STORE },
  );
}
