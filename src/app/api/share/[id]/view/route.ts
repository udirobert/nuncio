import { NextRequest, NextResponse } from "next/server";
import { getShareRecord, updateShareRecord } from "@/lib/share-store";
import { readAccountSession } from "@/lib/auth/session";
import { getActiveHandoffForShare } from "@/lib/live-handoff";
import { RATE_LIMITS, checkRateLimit, getClientId } from "@/lib/rate-limit";

/**
 * View beacon — records that a recipient opened a link.
 *
 * This is the one signal that turns the inbox from a log of links into a list
 * of relationships: "waiting on Maya · they opened it Tuesday" is materially
 * different from "sent 5 days ago, silence".
 *
 * Privacy: it stores a timestamp and a counter. No IP, no user agent, no
 * recipient identity. The owner's own views never count, and invitation-
 * protected links are never counted (their only viewer is the owner).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rate = await checkRateLimit(getClientId(request), "share-view", RATE_LIMITS.shareView);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const record = await getShareRecord(id);
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Invitation-protected links: the only legitimate viewer is the owner.
  const { protected: isProtected } = await getActiveHandoffForShare(record);
  if (isProtected) {
    return NextResponse.json({ ok: true, counted: false });
  }

  // The sender's own preview is not a prospect opening the link.
  const session = readAccountSession(request);
  if (session?.workspaceId && record.workspaceId === session.workspaceId) {
    return NextResponse.json({ ok: true, counted: false });
  }

  const updated = await updateShareRecord(id, {
    firstViewedAt: record.firstViewedAt ?? new Date().toISOString(),
    viewCount: (record.viewCount ?? 0) + 1,
  });

  return NextResponse.json({ ok: true, counted: Boolean(updated) });
}
