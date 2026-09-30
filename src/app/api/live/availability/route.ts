import { NextRequest, NextResponse } from "next/server";
import { getShareRecord } from "@/lib/share-store";
import { getAccountStorageProvider } from "@/lib/storage";
import { readAccountSession } from "@/lib/auth/session";
import { isLiveLinkEnabled } from "@/lib/live-link";
import {
  CALL_AVAILABILITY_TTL_MS,
  areCallRequestsEnabledForShare,
  browserMutationAllowed,
  isCallAvailabilityActive,
  isWorkspaceOwner,
} from "@/lib/call-request";
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Availability is an explicit, expiring sender setting — never inferred from
 * a calendar. Public callers (a share link visitor) only ever learn the two
 * booleans; the owner gets their own expiry back.
 */
export async function GET(request: NextRequest) {
  if (!isLiveLinkEnabled()) {
    return NextResponse.json({ error: "LiveLink is not enabled" }, { status: 404, headers: NO_STORE });
  }

  const shareId = request.nextUrl.searchParams.get("shareId");
  if (shareId) {
    const share = await getShareRecord(shareId);
    if (!share || share.deliveryMode !== "livelink" || !share.workspaceId) {
      return NextResponse.json({ acceptingCalls: false, callRequestsEnabled: false }, { headers: NO_STORE });
    }
    const enabled = areCallRequestsEnabledForShare(share);
    if (!enabled) {
      return NextResponse.json({ acceptingCalls: false, callRequestsEnabled: false }, { headers: NO_STORE });
    }
    const workspace = await getAccountStorageProvider().getWorkspace(share.workspaceId);
    return NextResponse.json(
      {
        acceptingCalls: isCallAvailabilityActive(workspace),
        callRequestsEnabled: true,
      },
      { headers: NO_STORE },
    );
  }

  const session = readAccountSession(request);
  if (!session || !await isWorkspaceOwner({ session, workspaceId: session.workspaceId })) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: NO_STORE });
  }
  const workspace = await getAccountStorageProvider().getWorkspace(session.workspaceId);
  return NextResponse.json(
    {
      acceptingCalls: isCallAvailabilityActive(workspace),
      callAvailabilityUntil: workspace?.callAvailabilityUntil ?? null,
      callRequestsEnabled: areCallRequestsEnabledForShare({ workspaceId: workspace?.id, senderEmail: session.email }),
    },
    { headers: NO_STORE },
  );
}

/**
 * Owner only: {available:true} opens a 15-minute window; {available:false}
 * clears it. Availability never auto-rejects a request created while it was
 * on — an owner can still accept a timely request after the window ends.
 */
export async function PATCH(request: NextRequest) {
  if (!isLiveLinkEnabled()) {
    return NextResponse.json({ error: "LiveLink is not enabled" }, { status: 404, headers: NO_STORE });
  }
  if (!browserMutationAllowed(request, true)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  }
  const session = readAccountSession(request);
  if (!session || !await isWorkspaceOwner({ session, workspaceId: session.workspaceId })) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: NO_STORE });
  }

  const body = (await request.json().catch(() => null)) as { available?: boolean } | null;
  if (typeof body?.available !== "boolean") {
    return NextResponse.json({ error: "available must be a boolean" }, { status: 400, headers: NO_STORE });
  }

  const updates: Record<string, string> = body.available
    ? { callAvailabilityUntil: new Date(Date.now() + CALL_AVAILABILITY_TTL_MS).toISOString() }
    : { callAvailabilityUntil: "" };
  await getAccountStorageProvider().updateWorkspace(session.workspaceId, updates);

  const workspace = await getAccountStorageProvider().getWorkspace(session.workspaceId);
  return NextResponse.json(
    {
      acceptingCalls: isCallAvailabilityActive(workspace),
      callAvailabilityUntil: workspace?.callAvailabilityUntil ?? null,
    },
    { headers: NO_STORE },
  );
}
