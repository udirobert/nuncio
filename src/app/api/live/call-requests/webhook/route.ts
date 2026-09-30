import { NextRequest, NextResponse } from "next/server";
import { WebhookReceiver } from "livekit-server-sdk";
import {
  cleanupCallRequestRoom,
  expireCallRequest,
  isCallRequestOpen,
  terminalizeCallRequest,
  updateCallRequest,
} from "@/lib/call-request";
import { applyCallPresenceObservation } from "@/lib/call-connection";
import { getCallRequestStorageProvider } from "@/lib/storage";
import type { CallRequestRecord } from "@/lib/storage/types";
import { getLiveKitConfig, listRoomParticipants, removeRoomParticipant } from "@/lib/livekit";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Signed LiveKit webhook for call-request rooms. Auth is mandatory — unsigned
 * or unverifiable events are rejected. Only rooms owned by a call request are
 * touched; unknown rooms and normal twin rooms without a call record are
 * ignored. Event handling is reconciliatory: participant events re-read the
 * room via REST and CAS-merge, so webhook retries stay idempotent.
 */
export async function POST(request: NextRequest) {
  const config = getLiveKitConfig();
  if (!config) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }

  const receiver = new WebhookReceiver(config.apiKey, config.apiSecret);
  let event;
  try {
    event = await receiver.receive(await request.text(), request.headers.get("authorization") ?? undefined);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401, headers: NO_STORE });
  }

  const roomName = event.room?.name;
  if (!roomName) {
    return NextResponse.json({ received: true }, { headers: NO_STORE });
  }

  const storage = getCallRequestStorageProvider();
  const record = await storage.getByRoomName(roomName);
  if (!record) {
    return NextResponse.json({ received: true }, { headers: NO_STORE });
  }

  if (event.event === "room_finished") {
    let snapshot;
    try {
      snapshot = await listRoomParticipants(roomName);
    } catch {
      return NextResponse.json({ error: "Room state could not be verified" }, { status: 502, headers: NO_STORE });
    }
    if (snapshot.roomExists) {
      return NextResponse.json({ received: true }, { headers: NO_STORE });
    }
    if (record.status === "pending" || record.status === "accepted") {
      await terminalizeCallRequest(record.id, "cancelled");
    } else if (!await cleanupCallRequestRoom(record)) {
      return NextResponse.json({ error: "Cleanup could not be confirmed" }, { status: 502, headers: NO_STORE });
    }
    return NextResponse.json({ received: true }, { headers: NO_STORE });
  }

  const active = record.status === "accepted" && isCallRequestOpen(record);
  if (record.status === "accepted" && !isCallRequestOpen(record)) {
    await expireCallRequest(record);
    const refreshed = await storage.getByRoomName(roomName);
    if (refreshed) {
      let ok = true;
      if (event.event === "participant_joined" && event.participant) {
        ok = await removeRoomParticipant(roomName, event.participant.identity)
          .then(() => true)
          .catch(() => false);
      }
      ok = (await reopenAndCleanup(refreshed)) && ok;
      if (!ok) {
        return NextResponse.json({ error: "Cleanup could not be confirmed" }, { status: 502, headers: NO_STORE });
      }
    }
    return NextResponse.json({ received: true }, { headers: NO_STORE });
  }

  if (!active) {
    if (event.event === "participant_joined" && event.participant) {
      const removed = await removeRoomParticipant(roomName, event.participant.identity)
        .then(() => true)
        .catch(() => false);
      const cleaned = await reopenAndCleanup(record);
      if (!removed || !cleaned) {
        return NextResponse.json({ error: "Cleanup could not be confirmed" }, { status: 502, headers: NO_STORE });
      }
    }
    return NextResponse.json({ received: true }, { headers: NO_STORE });
  }

  if (event.event === "participant_joined" || event.event === "participant_left") {
    if (!record.ownerIdentity || !record.recipientIdentity) {
      return NextResponse.json({ received: true }, { headers: NO_STORE });
    }
    try {
      const snapshot = await listRoomParticipants(roomName);
      const observation = {
        ownerPresent: snapshot.participantIdentities.includes(record.ownerIdentity),
        recipientPresent: snapshot.participantIdentities.includes(record.recipientIdentity),
        observedAt: new Date().toISOString(),
      };
      await updateCallRequest(record.id, ["accepted"], (current) =>
        isCallRequestOpen(current)
          ? { ...current, connection: applyCallPresenceObservation(current.connection, observation) }
          : null);
    } catch {
      return NextResponse.json({ error: "Presence could not be verified" }, { status: 502, headers: NO_STORE });
    }
  }

  return NextResponse.json({ received: true }, { headers: NO_STORE });
}

async function reopenAndCleanup(record: CallRequestRecord): Promise<boolean> {
  let current = record;
  if (current.roomClosedAt && current.roomName) {
    const cleared = await updateCallRequest(current.id, [current.status], (fresh) =>
      fresh.roomName === current.roomName ? { ...fresh, roomClosedAt: undefined } : null);
    if (cleared) current = cleared;
  }
  return cleanupCallRequestRoom(current);
}
