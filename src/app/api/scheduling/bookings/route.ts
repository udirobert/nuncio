import { NextRequest, NextResponse } from "next/server";
import { getSchedulingStorageProvider, getShareStorageProvider } from "@/lib/storage";
import { readAccountSession } from "@/lib/auth/session";
import { isWorkspaceOwner } from "@/lib/call-request";

const PRIVATE_HEADERS = { "Cache-Control": "no-store", Vary: "Cookie" };

export async function GET(request: NextRequest) {
  const session = readAccountSession(request);
  if (!session?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE_HEADERS });
  }
  if (!await isWorkspaceOwner({ session, workspaceId: session.workspaceId })) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE_HEADERS });
  }

  const records = await getSchedulingStorageProvider().listByWorkspace(session.workspaceId, 50);
  const shares = getShareStorageProvider();
  const bookings = await Promise.all(records.map(async (record) => {
    let recipient: string | null = null;
    try {
      const share = await shares.get(record.shareId);
      if (share && share.workspaceId === record.workspaceId) {
        recipient = share.recipientName || null;
      }
    } catch {
      recipient = null;
    }
    return {
      id: record.id,
      status: record.status,
      createdAt: record.createdAt,
      startsAt: record.startsAt ?? null,
      endsAt: record.endsAt ?? null,
      recipient,
      reviewedBrief: record.reviewedBrief ?? null,
    };
  }));

  return NextResponse.json({ bookings }, { headers: PRIVATE_HEADERS });
}
