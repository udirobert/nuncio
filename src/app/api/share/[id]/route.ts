import { NextRequest, NextResponse } from "next/server";
import { getShareRecord, updateShareRecord } from "@/lib/share-store";
import { readAccountSession } from "@/lib/auth/session";
import { signRecordAssets } from "@/lib/storage/media-store";
import { getAccountStorageProvider } from "@/lib/storage";
import { isLiveLinkAllowed } from "@/lib/live-link";
import {
  authorizeHandoffShare,
  effectiveHandoffNextStep,
  getActiveHandoffForShare,
  getHandoffOptions,
} from "@/lib/live-handoff";
import { browserMutationAllowed, isWorkspaceOwner } from "@/lib/call-request";

const PRIVATE_HEADERS = { "Cache-Control": "no-store", Vary: "Cookie" };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await getShareRecord(id);

  if (!record) {
    return NextResponse.json({ error: "Share not found" }, { status: 404, headers: PRIVATE_HEADERS });
  }

  if (record.deliveryMode === "livelink" && !isLiveLinkAllowed({
    workspaceId: record.workspaceId,
    senderEmail: record.senderEmail,
  })) {
    return NextResponse.json(
      { error: "Live link is no longer available" },
      { status: 404, headers: PRIVATE_HEADERS },
    );
  }

  const { record: handoff, protected: isProtected } = await getActiveHandoffForShare(record);
  if (isProtected && !handoff) {
    return NextResponse.json({ error: "Share not found" }, { status: 404, headers: PRIVATE_HEADERS });
  }
  if (!await authorizeHandoffShare(request, record)) {
    return NextResponse.json({ error: "Share not found" }, { status: 404, headers: PRIVATE_HEADERS });
  }

  // Resolve private B2 asset URLs to presigned download URLs
  const signed = await signRecordAssets(record);
  const publicRecord: Record<string, unknown> = { ...signed };
  delete publicRecord.senderEmail;
  if (handoff) {
    delete publicRecord.handoffId;
    const workspace = record.workspaceId
      ? await getAccountStorageProvider().getWorkspace(record.workspaceId)
      : null;
    const options = getHandoffOptions(record, workspace, true);
    publicRecord.handoff = {
      recommendedNextStep: effectiveHandoffNextStep(handoff.recommendedNextStep, options),
      expiresAt: handoff.expiresAt,
      options,
    };
  } else {
    delete publicRecord.handoffId;
  }

  return NextResponse.json(publicRecord, { headers: PRIVATE_HEADERS });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const updates = await request.json() as Record<string, unknown>;
  const safeUpdates = Object.fromEntries(
    ["videoUrl", "videoId", "trace", "thumbnailUrl", "generation", "privacy"]
      .filter((key) => key in updates)
      .map((key) => [key, updates[key]])
  );

  const session = readAccountSession(request);
  const internalToken = request.headers.get("x-nuncio-internal-token");
  const expectedInternalToken = process.env.NUNCIO_INTERNAL_API_TOKEN;
  const isInternalRequest = Boolean(expectedInternalToken && internalToken === expectedInternalToken);
  const recordBeforeUpdate = await getShareRecord(id);
  if (!recordBeforeUpdate) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }
  if (
    recordBeforeUpdate.workspaceId &&
    recordBeforeUpdate.workspaceId !== session?.workspaceId &&
    !isInternalRequest
  ) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  if (recordBeforeUpdate.handoffId && !isInternalRequest) {
    const owner = recordBeforeUpdate.workspaceId
      ? await isWorkspaceOwner({ session, workspaceId: recordBeforeUpdate.workspaceId })
      : false;
    if (!owner || !browserMutationAllowed(request, true)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  }
  if (recordBeforeUpdate.handoffId && safeUpdates.privacy === "public") {
    return NextResponse.json({ error: "This share cannot be made public" }, { status: 403 });
  }

  const record = await updateShareRecord(id, safeUpdates);

  if (!record) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }
  const publicRecord: Record<string, unknown> = { ...record };
  delete publicRecord.senderEmail;
  delete publicRecord.handoffId;
  return NextResponse.json(publicRecord);
}
