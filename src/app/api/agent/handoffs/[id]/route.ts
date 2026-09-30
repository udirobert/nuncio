import { NextRequest, NextResponse } from "next/server";
import { validateAgentRequest } from "@/lib/agent-auth";
import {
  getAccountStorageProvider,
  getCallRequestStorageProvider,
  getHandoffStorageProvider,
} from "@/lib/storage";
import {
  effectiveHandoffNextStep,
  getHandoffOptions,
  isHandoffActive,
} from "@/lib/live-handoff";
import { isLiveLinkAllowed } from "@/lib/live-link";
import { getShareRecord } from "@/lib/share-store";
import { absoluteUrl } from "@/lib/url";

const NO_STORE = { "Cache-Control": "no-store" };

type RouteContext = { params: Promise<{ id: string }> };

async function requireWorkspace(request: NextRequest) {
  const auth = validateAgentRequest(request);
  if (!auth.ok) return { auth } as const;
  if (!process.env.NUNCIO_AGENT_WORKSPACE_ID) {
    return { auth: { ok: false as const, error: "NUNCIO_AGENT_WORKSPACE_ID is required", status: 503 } };
  }
  return { auth };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { auth } = await requireWorkspace(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  const { id } = await context.params;
  const record = await getHandoffStorageProvider().get(id);
  if (!record || record.workspaceId !== auth.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }

  const share = await getShareRecord(record.shareId);
  const workspace = await getAccountStorageProvider().getWorkspace(record.workspaceId);
  const linkageValid = Boolean(
    share
    && share.handoffId === record.id
    && share.id === record.shareId
    && share.workspaceId === record.workspaceId
    && share.deliveryMode === "livelink"
    && workspace?.ownerUserId
    && isLiveLinkAllowed({ workspaceId: share.workspaceId, senderEmail: share.senderEmail }),
  );
  const active = linkageValid && isHandoffActive(record);
  const options = share && active
    ? getHandoffOptions(share, workspace, active)
    : { twin: false, callRequestsEnabled: false, acceptingCalls: false, bookingUrl: null };
  const calls = (await getCallRequestStorageProvider().listByWorkspace(record.workspaceId, 50))
    .filter((request) => request.shareId === record.shareId)
    .map((request) => ({
      requestId: request.id,
      status: request.status,
      createdAt: request.createdAt,
      expiresAt: request.expiresAt,
    }));

  return NextResponse.json(
    {
      handoffId: record.id,
      shareId: record.shareId,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      revoked: Boolean(record.revokedAt),
      active,
      recommendedNextStep: effectiveHandoffNextStep(record.recommendedNextStep, options),
      context: record.context,
      options,
      callRequests: calls,
      callRequestsScope: "latest 50 call requests in this workspace",
      dashboardUrl: absoluteUrl("/dashboard", request),
    },
    { headers: NO_STORE },
  );
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { auth } = await requireWorkspace(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  const { id } = await context.params;
  const record = await getHandoffStorageProvider().revoke(id, auth.workspaceId, new Date());
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  return NextResponse.json(
    { handoffId: record.id, revoked: true, revokedAt: record.revokedAt },
    { headers: NO_STORE },
  );
}
