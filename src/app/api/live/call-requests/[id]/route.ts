import { NextRequest, NextResponse } from "next/server";
import {
  getCallRequestStorageProvider,
  getLiveSessionStorageProvider,
} from "@/lib/storage";
import { readAccountSession } from "@/lib/auth/session";
import { isLiveLinkEnabled } from "@/lib/live-link";
import {
  CALL_REQUEST_ACCEPTED_TTL_MS,
  authenticateCallRequest,
  browserMutationAllowed,
  callRequestShareStillValid,
  cleanupCallRequestRoom,
  getCallRequest,
  isCallRequestOpen,
  isWorkspaceOwner,
  terminalizeCallRequest,
  twinSessionRoomIsReusable,
  updateCallRequest,
} from "@/lib/call-request";
import { createCallRoom, listRoomParticipants } from "@/lib/livekit";

const NO_STORE = { "Cache-Control": "no-store" };

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Recipient/owner status poll. Returns only the request status and expiry —
 * no capability hash, no other prospect data.
 */
export async function GET(request: NextRequest, context: RouteContext) {
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
  const record = await getCallRequest(id);
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  return NextResponse.json(
    { id: record.id, status: record.status, expiresAt: record.expiresAt, roomReady: Boolean(record.roomReady) },
    { headers: NO_STORE },
  );
}

/**
 * Owner decision. `accept` claims the request first with a versioned CAS that
 * records identities plus the room it intends to use — a reused open Synthesia
 * twin room when the request was raised inside one, otherwise a unique
 * per-attempt room name — so racing accepts can never create the same room and
 * a loser never deletes the winner's room. The winner alone creates its
 * candidate room afterwards and only then flips roomReady. `decline` CAS-flips
 * pending to declined through the shared lifecycle path.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isLiveLinkEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  if (!browserMutationAllowed(request, true)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  }
  const { id } = await context.params;
  const raw = await getCallRequestStorageProvider().get(id);
  if (!raw) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }

  const session = readAccountSession(request);
  if (!await isWorkspaceOwner({ session, workspaceId: raw.workspaceId })) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  if (!await callRequestShareStillValid(raw)) {
    return NextResponse.json({ error: "Calls are not available" }, { status: 404, headers: NO_STORE });
  }
  const record = await getCallRequest(id);
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }

  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  if (body?.action !== "accept" && body?.action !== "decline") {
    return NextResponse.json({ error: "action must be 'accept' or 'decline'" }, { status: 400, headers: NO_STORE });
  }

  const notPending = async () => {
    const current = await getCallRequest(record.id);
    return NextResponse.json(
      { error: "Request is no longer pending", status: current?.status ?? "unknown" },
      { status: 409, headers: NO_STORE },
    );
  };

  if (body.action === "decline") {
    const declined = await terminalizeCallRequest(record.id, "declined", ["pending"]);
    if (!declined || declined.status !== "declined") return notPending();
    return NextResponse.json({ id: declined.id, status: declined.status }, { headers: NO_STORE });
  }

  if (record.status === "accepted" && isCallRequestOpen(record)) {
    return NextResponse.json(
      { id: record.id, status: record.status, expiresAt: record.expiresAt, roomReady: Boolean(record.roomReady) },
      { headers: NO_STORE },
    );
  }
  if (record.status !== "pending") return notPending();
  if (!isCallRequestOpen(record)) return notPending();

  let roomName: string;
  let recipientIdentity: string;
  let roomReady = false;
  let reused = false;
  const twin = record.liveSessionId
    ? await getLiveSessionStorageProvider().get(record.liveSessionId)
    : null;
  if (twinSessionRoomIsReusable(twin, record.shareId, record.workspaceId)) {
    try {
      const snapshot = await listRoomParticipants(twin.roomName);
      if (snapshot.roomExists) {
        roomName = twin.roomName;
        recipientIdentity = `guest-${twin.id}`;
        roomReady = true;
        reused = true;
      } else {
        roomName = `nuncio-call-${record.id}-${crypto.randomUUID()}`;
        recipientIdentity = `recipient-${record.id}`;
      }
    } catch {
      roomName = `nuncio-call-${record.id}-${crypto.randomUUID()}`;
      recipientIdentity = `recipient-${record.id}`;
    }
  } else {
    roomName = `nuncio-call-${record.id}-${crypto.randomUUID()}`;
    recipientIdentity = `recipient-${record.id}`;
  }

  const claimed = await updateCallRequest(
    record.id,
    ["pending"],
    (current) => {
      const claimedAt = new Date();
      return {
        ...current,
        status: "accepted",
        acceptedAt: claimedAt.toISOString(),
        expiresAt: new Date(claimedAt.getTime() + CALL_REQUEST_ACCEPTED_TTL_MS).toISOString(),
        roomName,
        roomReady,
        ownerIdentity: `owner-${session!.userId}`,
        recipientIdentity,
      };
    },
    { requireFresh: true },
  );
  if (!claimed) return notPending();

  if (reused) {
    return NextResponse.json(
      { id: claimed.id, status: claimed.status, expiresAt: claimed.expiresAt, roomReady: true },
      { headers: NO_STORE },
    );
  }

  const abandonClaimedRoom = async () => {
    let latest: Awaited<ReturnType<typeof getCallRequest>> = await getCallRequestStorageProvider().get(record.id);
    if (!latest || latest.roomName !== roomName) return;
    if (latest.status === "pending" || latest.status === "accepted") {
      latest = await terminalizeCallRequest(record.id, "cancelled", ["pending", "accepted"]);
    }
    if (!latest || latest.roomName !== roomName) return;
    if (latest.roomClosedAt) {
      const cleared = await updateCallRequest(record.id, [latest.status], (current) =>
        current.roomName === roomName ? { ...current, roomClosedAt: undefined } : null);
      if (cleared) latest = cleared;
    }
    await cleanupCallRequestRoom(latest);
  };

  try {
    await createCallRoom(roomName);
  } catch {
    await updateCallRequest(record.id, ["accepted", "cancelled"], (current) =>
      current.roomName === roomName
        ? { ...current, status: "cancelled", roomClosedAt: undefined, cleanupError: true }
        : null);
    const latest = await getCallRequestStorageProvider().get(record.id);
    if (latest) await cleanupCallRequestRoom(latest);
    return NextResponse.json(
      { error: "Could not open a call room", status: "cancelled" },
      { status: 500, headers: NO_STORE },
    );
  }

  const ready = await updateCallRequest(record.id, ["accepted"], (current) =>
    current.roomName === roomName && isCallRequestOpen(current)
      ? { ...current, roomReady: true }
      : null,
    { requireFresh: true },
  );
  if (!ready) {
    await abandonClaimedRoom();
    const current = await getCallRequest(record.id);
    return NextResponse.json(
      { error: "Request is no longer active", status: current?.status ?? "unknown" },
      { status: 409, headers: NO_STORE },
    );
  }
  return NextResponse.json(
    { id: ready.id, status: ready.status, expiresAt: ready.expiresAt, roomReady: true },
    { headers: NO_STORE },
  );
}
