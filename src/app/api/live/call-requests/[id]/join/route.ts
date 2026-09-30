import { NextRequest, NextResponse } from "next/server";
import { getCallRequestStorageProvider } from "@/lib/storage";
import { isLiveLinkEnabled } from "@/lib/live-link";
import {
  CALL_JOIN_TOKEN_MAX_TTL_S,
  authenticateCallRequest,
  browserMutationAllowed,
  callRequestShareStillValid,
  getCallRequest,
  isCallRequestOpen,
} from "@/lib/call-request";
import { mintCallParticipantToken, getLiveKitConfig } from "@/lib/livekit";

const NO_STORE = { "Cache-Control": "no-store" };

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Join an accepted call. Recipient proof is the bearer capability issued at
 * request creation; owner proof is the authenticated workspace session. Both
 * get a short-lived LiveKit token scoped to subscribe + microphone only —
 * TTL never exceeds the request's own expiry or 60 seconds. No token is
 * minted until the room is confirmed ready.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  if (!isLiveLinkEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  const { id } = await context.params;
  const raw = await getCallRequestStorageProvider().get(id);
  if (!raw) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  const auth = await authenticateCallRequest(request, raw);
  if (!auth) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  if (auth.role === "owner" && !browserMutationAllowed(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  }
  const record = await getCallRequest(id);
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  if (!await callRequestShareStillValid(record)) {
    return NextResponse.json({ error: "Calls are not available" }, { status: 404, headers: NO_STORE });
  }

  if (record.status !== "accepted" || !isCallRequestOpen(record) || !record.roomName) {
    return NextResponse.json(
      { error: "This call is not joinable", status: record.status },
      { status: 409, headers: NO_STORE },
    );
  }
  if (!record.roomReady) {
    return NextResponse.json(
      { error: "The call room is not ready yet", status: record.status, roomReady: false },
      { status: 409, headers: NO_STORE },
    );
  }

  const config = getLiveKitConfig();
  if (!config) {
    return NextResponse.json({ error: "Calls are not available" }, { status: 503, headers: NO_STORE });
  }

  const identity = auth.role === "owner" ? record.ownerIdentity : record.recipientIdentity;
  if (!identity) {
    return NextResponse.json({ error: "This call is not joinable", status: record.status }, { status: 409, headers: NO_STORE });
  }
  const otherIdentity = auth.role === "owner" ? record.recipientIdentity : record.ownerIdentity;

  const ttlSeconds = Math.max(
    1,
    Math.min(
      CALL_JOIN_TOKEN_MAX_TTL_S,
      Math.ceil((new Date(record.expiresAt).getTime() - Date.now()) / 1000),
    ),
  );
  const participantToken = await mintCallParticipantToken({
    identity,
    roomName: record.roomName,
    ttlSeconds,
  });

  return NextResponse.json(
    {
      serverUrl: config.url,
      participantToken,
      roomName: record.roomName,
      role: auth.role,
      identity,
      expectedOtherIdentity: otherIdentity ?? null,
      expiresAt: record.expiresAt,
      reusedRoom: Boolean(record.liveSessionId) && record.roomName === `nuncio-live-${record.liveSessionId}`,
    },
    { headers: NO_STORE },
  );
}
