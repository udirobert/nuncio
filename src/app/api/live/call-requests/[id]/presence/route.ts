import { NextRequest, NextResponse } from "next/server";
import { getCallRequestStorageProvider } from "@/lib/storage";
import { isLiveLinkEnabled } from "@/lib/live-link";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  authenticateCallRequest,
  browserMutationAllowed,
  callRequestShareStillValid,
  getCallRequest,
  isCallRequestOpen,
  updateCallRequest,
} from "@/lib/call-request";
import { applyCallPresenceObservation } from "@/lib/call-connection";
import { isCallRequestInfraConfigured, listRoomParticipants } from "@/lib/livekit";

const NO_STORE = { "Cache-Control": "no-store" };

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Server-observed room presence. The client only triggers a check — it never
 * supplies booleans or timestamps. Membership comes from the LiveKit REST API
 * matched against the exact identities recorded at accept; observedAt is set
 * by the server after the provider answer, so these are server-observed times
 * that may lag real connect/disconnect by the heartbeat cadence.
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

  const rateLimit = await checkRateLimit(
    `${record.id}:${auth.role === "owner" ? auth.session!.userId : "recipient"}`,
    "live.callPresence",
    { maxRequests: 30, windowSeconds: 60 },
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rateLimit.resetIn },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(rateLimit.resetIn) } },
    );
  }

  if (record.status !== "accepted" || !isCallRequestOpen(record) || !record.roomName || !record.roomReady) {
    return NextResponse.json(
      { error: "This call is not active", status: record.status },
      { status: 409, headers: NO_STORE },
    );
  }
  if (!record.ownerIdentity || !record.recipientIdentity) {
    return NextResponse.json({ error: "This call is not active", status: record.status }, { status: 409, headers: NO_STORE });
  }
  if (!isCallRequestInfraConfigured()) {
    return NextResponse.json({ error: "Presence is unavailable" }, { status: 503, headers: NO_STORE });
  }

  let snapshot;
  try {
    snapshot = await listRoomParticipants(record.roomName);
  } catch {
    return NextResponse.json({ error: "Presence could not be verified" }, { status: 502, headers: NO_STORE });
  }

  const observedAt = new Date().toISOString();
  const observation = {
    ownerPresent: snapshot.participantIdentities.includes(record.ownerIdentity),
    recipientPresent: snapshot.participantIdentities.includes(record.recipientIdentity),
    observedAt,
  };

  const updated = await updateCallRequest(record.id, ["accepted"], (current) =>
    isCallRequestOpen(current)
      ? { ...current, connection: applyCallPresenceObservation(current.connection, observation) }
      : null,
    { requireFresh: true });

  if (!updated) {
    const latest = await getCallRequest(record.id);
    return NextResponse.json(
      { error: "This call is not active", status: latest?.status ?? "unknown" },
      { status: 409, headers: NO_STORE },
    );
  }

  return NextResponse.json(
    { id: record.id, connection: updated.connection },
    { headers: NO_STORE },
  );
}
