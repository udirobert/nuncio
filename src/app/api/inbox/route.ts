import { NextRequest, NextResponse } from "next/server";
import { readAccountSession } from "@/lib/auth/session";
import { listShares } from "@/lib/share-store";
import {
  getCallRequestStorageProvider,
  getLiveSessionStorageProvider,
  getSchedulingStorageProvider,
} from "@/lib/storage";
import { isLiveLinkEnabled } from "@/lib/live-link";
import type { InboxBooking, InboxEntry, InboxPayload, InboxSession, RelationshipState } from "@/lib/inbox";
import { deriveRelationshipState } from "@/lib/inbox";

const OWNER_HEADERS = { "Cache-Control": "no-store", Vary: "Cookie" };

/**
 * The inbox read path.
 *
 * One request feeds the whole dashboard: the first-touch list with its
 * relationship state, the scoreboard, and the bookings card.
 *
 * States, in order of progress:
 *   sent      — created, never opened
 *   opened    — the recipient opened the link
 *   talking   — a live session started
 *   booked    — a booking exists for the link
 *   requested — a human call request is waiting on the owner
 */
export async function GET(request: NextRequest) {
  const session = readAccountSession(request);
  if (!session) {
    return NextResponse.json(
      { entries: [], sessions: [], bookings: [], videoCount: 0 } satisfies InboxPayload,
      { headers: OWNER_HEADERS },
    );
  }

  const shares = await listShares({ workspaceId: session.workspaceId, limit: 50 });

  // Live sessions are only recorded when the LiveLink pilot is on; without
  // it the inbox is still correct, just quieter.
  const sessions = isLiveLinkEnabled()
    ? await getLiveSessionStorageProvider()
        .listRecent({ workspaceId: session.workspaceId, limit: 100 })
        .catch(() => [])
    : [];

  const bookings = await getSchedulingStorageProvider()
    .listByWorkspace(session.workspaceId, 100)
    .catch(() => []);

  // A live call request waiting on the owner is the loudest relationship
  // state there is.
  const callRequests = await getCallRequestStorageProvider()
    .listByWorkspace(session.workspaceId, 100)
    .catch(() => []);

  const byShare = new Map<string, { conversations: number; lastActivityAt: string | null }>();
  for (const record of sessions) {
    if (!record.shareId) continue;
    const existing = byShare.get(record.shareId);
    const started = record.startedAt || record.createdAt;
    byShare.set(record.shareId, {
      conversations: (existing?.conversations ?? 0) + 1,
      lastActivityAt: latest(existing?.lastActivityAt, started),
    });
  }

  const bookedShares = new Set<string>();
  for (const booking of bookings) {
    if (booking.shareId) bookedShares.add(booking.shareId);
  }

  const requestedShares = new Set<string>();
  for (const callRequest of callRequests) {
    if (callRequest.status !== "pending" && callRequest.status !== "accepted") continue;
    if (callRequest.shareId) requestedShares.add(callRequest.shareId);
  }

  const entries: InboxEntry[] = shares.map((share) => {
    const activity = byShare.get(share.id);
    const state: RelationshipState = deriveRelationshipState({
      hasCallRequest: requestedShares.has(share.id),
      hasBooking: bookedShares.has(share.id),
      conversationCount: activity?.conversations ?? 0,
      firstViewedAt: share.firstViewedAt,
    });

    return {
      id: share.id,
      recipientName: share.recipientName ?? null,
      senderName: share.senderName ?? null,
      createdAt: share.createdAt,
      deliveryMode: share.deliveryMode ?? null,
      hasRecordedVideo: Boolean(share.videoUrl || share.videoId),
      invitationProtected: Boolean(share.handoffId),
      state,
      lastActivityAt: activity?.lastActivityAt ?? share.firstViewedAt ?? null,
      conversationCount: activity?.conversations ?? 0,
      firstViewedAt: share.firstViewedAt ?? null,
    };
  });

  const payload: InboxPayload = {
    entries,
    videoCount: shares.filter((share) => Boolean(share.videoUrl)).length,
    sessions: sessions.map(
      (record): InboxSession => ({
        id: record.id,
        shareId: record.shareId,
        status: record.status,
        createdAt: record.createdAt,
        startedAt: record.startedAt,
        endedAt: record.endedAt,
        durationMs: record.durationMs,
        terminalReason: record.terminalReason,
        metrics: record.metrics,
      }),
    ),
    bookings: bookings.map((booking): InboxBooking => ({
      id: booking.id,
      shareId: booking.shareId,
      status: booking.status,
      createdAt: booking.createdAt,
      startsAt: booking.startsAt ?? null,
      endsAt: booking.endsAt ?? null,
      recipient: shares.find((share) => share.id === booking.shareId)?.recipientName ?? null,
      reviewedBrief: booking.reviewedBrief ?? null,
    })),
  };

  return NextResponse.json(payload, { headers: OWNER_HEADERS });
}

function latest(a: string | null | undefined, b: string | null | undefined): string | null {
  const left = a ?? null;
  const right = b ?? null;
  if (!left) return right;
  if (!right) return left;
  return left > right ? left : right;
}
