import { NextRequest, NextResponse } from "next/server";
import { getShareRecord, updateShareRecord } from "@/lib/share-store";
import { readAccountSession } from "@/lib/auth/session";
import { signRecordAssets } from "@/lib/storage/media-store";
import { isLiveLinkAllowed } from "@/lib/live-link";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await getShareRecord(id);

  if (!record) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }

  if (record.deliveryMode === "livelink" && !isLiveLinkAllowed({
    workspaceId: record.workspaceId,
    senderEmail: record.senderEmail,
  })) {
    return NextResponse.json({ error: "Live link is no longer available" }, { status: 404 });
  }

  // Resolve private B2 asset URLs to presigned download URLs
  const signed = await signRecordAssets(record);
  const publicRecord = { ...signed };
  delete publicRecord.senderEmail;

  return NextResponse.json(publicRecord);
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

  const record = await updateShareRecord(id, safeUpdates);

  if (!record) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }  const publicRecord = { ...record };
  delete publicRecord.senderEmail;
  return NextResponse.json(publicRecord);
}
