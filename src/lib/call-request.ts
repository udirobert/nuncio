import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import type { CallRequestRecord, LiveSessionRecord, WorkspaceAccount } from "@/lib/storage/types";
import { getAccountStorageProvider, getCallRequestStorageProvider } from "@/lib/storage";
import { deleteRoom, isCallRequestInfraConfigured, listRoomParticipants, removeRoomParticipant } from "@/lib/livekit";
import { isLiveLinkAllowed } from "@/lib/live-link";
import { readAccountSession, type AccountSession } from "@/lib/auth/session";
import { resolvePublicOrigin } from "@/lib/url";

export const CALL_REQUEST_PENDING_TTL_MS = 2 * 60_000;
export const CALL_REQUEST_ACCEPTED_TTL_MS = 10 * 60_000;
export const CALL_ROOM_EMPTY_TIMEOUT_S = 10 * 60;
export const CALL_ROOM_MAX_DURATION_S = 10 * 60;
export const CALL_ROOM_MAX_PARTICIPANTS = 4;
export const CALL_JOIN_TOKEN_MAX_TTL_S = 60;
export const SYNTHESIA_AVATAR_WAIT_MS = 60_000;
export const SYNTHESIA_AGENT_NAME = "nuncio-synthesia";
export const SYNTHESIA_AVATAR_PARTICIPANT_IDENTITY = "synthesia-avatar-agent";
export const CALL_AVAILABILITY_TTL_MS = 15 * 60_000;

const CAS_RETRIES = 3;

export function isCallAvailabilityActive(workspace: WorkspaceAccount | null, now = new Date()): boolean {
  return senderAcceptingCalls(workspace, now);
}

export function areCallRequestsEnabledForShare(share: { workspaceId?: string; senderEmail?: string }): boolean {
  return isLiveLinkAllowed({ workspaceId: share.workspaceId, senderEmail: share.senderEmail })
    && isCallRequestInfraConfigured();
}

export async function isWorkspaceOwner(input: {
  session: AccountSession | null;
  workspaceId: string;
}): Promise<boolean> {
  const { session, workspaceId } = input;
  if (!session || session.workspaceId !== workspaceId) return false;
  const workspace = await getAccountStorageProvider().getWorkspace(workspaceId);
  return Boolean(workspace && workspace.ownerUserId === session.userId);
}

export interface CallRequestAuth {
  role: "owner" | "recipient";
  session?: AccountSession;
}

export async function authenticateCallRequest(
  request: NextRequest,
  record: CallRequestRecord,
): Promise<CallRequestAuth | null> {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match && recipientTokenMatches(record, match[1].trim())) {
    return { role: "recipient" };
  }
  const session = readAccountSession(request);
  if (session && await isWorkspaceOwner({ session, workspaceId: record.workspaceId })) {
    return { role: "owner", session };
  }
  return null;
}

export async function getCallRequest(id: string): Promise<CallRequestRecord | null> {
  return resolveCallRequest(id);
}

export function mintRecipientToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashRecipientToken(token) };
}

export function hashRecipientToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function recipientTokenMatches(record: CallRequestRecord, token: string): boolean {
  const presented = Buffer.from(hashRecipientToken(token));
  const expected = Buffer.from(record.recipientTokenHash);
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}

export function isCallRequestOpen(record: CallRequestRecord, now = new Date()): boolean {
  return (record.status === "pending" || record.status === "accepted")
    && new Date(record.expiresAt).getTime() > now.getTime();
}

export function senderAcceptingCalls(workspace: WorkspaceAccount | null, now = new Date()): boolean {
  if (!workspace?.callAvailabilityUntil) return false;
  return new Date(workspace.callAvailabilityUntil).getTime() > now.getTime();
}

/**
 * CSRF guard for cookie-authenticated mutations. Browser cross-site POST/PATCH
 * carries Origin (must match the public origin) and Sec-Fetch-Site (must not be
 * cross-site); JSON content-type blocks simple-request form submissions.
 */
export function browserMutationAllowed(request: NextRequest, requireJson = false): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(resolvePublicOrigin(request)).origin) return false;
    } catch {
      return false;
    }
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site" && fetchSite !== "none") return false;
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (contentType ? !contentType.includes("application/json") : requireJson) return false;
  return true;
}

export async function resolveCallRequest(id: string): Promise<CallRequestRecord | null> {
  const storage = getCallRequestStorageProvider();
  const record = await storage.get(id);
  if (!record) return null;
  if ((record.status === "pending" || record.status === "accepted")
    && new Date(record.expiresAt).getTime() <= Date.now()) {
    const expired = await expireCallRequest(record);
    return expired || record;
  }
  return record;
}

export function bumpVersion(record: CallRequestRecord): CallRequestRecord {
  return { ...record, version: (record.version ?? 0) + 1 };
}

/**
 * CAS a single record, retrying against a fresh read so concurrent writes
 * (cancellation, presence merges) are never clobbered. `mutate` must return
 * null to abort. Up to three attempts.
 */
export async function updateCallRequest(
  id: string,
  from: CallRequestRecord["status"][],
  mutate: (current: CallRequestRecord) => CallRequestRecord | null,
  options?: { requireFresh?: boolean },
): Promise<CallRequestRecord | null> {
  const storage = getCallRequestStorageProvider();
  for (let attempt = 0; attempt < CAS_RETRIES; attempt += 1) {
    const current = await storage.get(id);
    if (!current || !from.includes(current.status)) return null;
    const next = mutate(current);
    if (!next) return null;
    const versioned = { ...next, version: (current.version ?? 0) + 1 };
    const updated = await storage.transition(id, from, versioned, options?.requireFresh ? new Date() : undefined, current.version ?? 0);
    if (updated) return updated;
  }
  return null;
}

/**
 * Terminalize a record through the versioned CAS and then tear down any room
 * it still owns. Idempotent; returns the latest record.
 */
export async function terminalizeCallRequest(
  id: string,
  status: "cancelled" | "expired" | "declined",
  from?: CallRequestRecord["status"][],
): Promise<CallRequestRecord | null> {
  const storage = getCallRequestStorageProvider();
  const allowedFrom = from ?? (["pending", "accepted"] as CallRequestRecord["status"][]);
  const current = await storage.get(id);
  if (!current) return null;
  if (!allowedFrom.includes(current.status)) {
    await cleanupCallRequestRoom(current);
    return storage.get(id);
  }
  const updated = await updateCallRequest(id, allowedFrom, (fresh) => ({ ...fresh, status }));
  const latest = updated || (await storage.get(id));
  if (latest) await cleanupCallRequestRoom(latest);
  return latest ? storage.get(id) : null;
}

export async function expireCallRequest(record: CallRequestRecord): Promise<CallRequestRecord | null> {
  const now = Date.now();
  if (record.status !== "pending" && record.status !== "accepted") return record;
  if (new Date(record.expiresAt).getTime() > now) return record;
  const storage = getCallRequestStorageProvider();
  const updated = await updateCallRequest(record.id, ["pending", "accepted"], (fresh) => {
    const deadline = new Date(fresh.expiresAt).getTime();
    return !(deadline > Date.now()) ? { ...fresh, status: "expired" } : null;
  });
  const latest = updated || (await storage.get(record.id));
  if (!latest) return null;
  if (latest.status === "expired") await cleanupCallRequestRoom(latest);
  return storage.get(record.id);
}

/** True when any accepted, non-expired request still protects this room. */
export async function hasAcceptedRoom(roomName: string, now = new Date()): Promise<boolean> {
  return getCallRequestStorageProvider().hasAcceptedRoom(roomName, now);
}

/**
 * Idempotent room teardown for a call request. Removes known participants,
 * deletes the room, then persists roomClosedAt only after confirmed absence.
 * Failures are flagged via cleanupError — never silently treated as success.
 */
export async function cleanupCallRequestRoom(record: CallRequestRecord): Promise<boolean> {
  if (!record.roomName || record.roomClosedAt) return true;
  const storage = getCallRequestStorageProvider();
  let failed = false;
  try {
    if (await hasAcceptedRoom(record.roomName)) return true;
    const identities = [record.ownerIdentity, record.recipientIdentity].filter(
      (identity): identity is string => Boolean(identity),
    );
    for (const identity of identities) {
      await removeRoomParticipant(record.roomName, identity);
    }
    await deleteRoom(record.roomName);
    const snapshot = await listRoomParticipants(record.roomName);
    if (snapshot.roomExists) failed = true;
  } catch {
    failed = true;
  }
  for (let attempt = 0; attempt < CAS_RETRIES; attempt += 1) {
    const current = await storage.get(record.id);
    if (!current) return false;
    const next = bumpVersion(failed
      ? { ...current, cleanupError: true }
      : { ...current, roomClosedAt: new Date().toISOString(), cleanupError: false });
    const updated = await storage.transition(
      current.id,
      [current.status],
      next,
      undefined,
      current.version ?? 0,
    );
    if (updated) return Boolean(updated.cleanupError) ? false : !failed;
  }
  return false;
}

/** One cron/list pass: expire overdue opens and retry room cleanup on terminal records. */
export async function runCallRequestCleanup(
  now = new Date(),
  workspaceId?: string,
): Promise<{ processed: number; errors: number }> {
  const storage = getCallRequestStorageProvider();
  const records = await storage.listForCleanup(now, workspaceId);
  let errors = 0;
  for (const record of records) {
    try {
      if ((record.status === "pending" || record.status === "accepted")
        && new Date(record.expiresAt).getTime() <= now.getTime()) {
        const result = await expireCallRequest(record);
        if (result?.cleanupError) errors += 1;
      } else {
        const closed = await cleanupCallRequestRoom(record);
        if (!closed) errors += 1;
      }
    } catch {
      errors += 1;
    }
  }
  return { processed: records.length, errors };
}

/** Re-verify the share behind a request is still a live-link share in an allowlisted workspace. */
export async function callRequestShareStillValid(record: CallRequestRecord): Promise<boolean> {
  const { getShareRecord } = await import("@/lib/share-store");
  const { handoffShareStillAuthorized } = await import("@/lib/live-handoff");
  const share = await getShareRecord(record.shareId);
  return Boolean(
    share
    && share.deliveryMode === "livelink"
    && share.workspaceId === record.workspaceId
    && areCallRequestsEnabledForShare(share)
    && await handoffShareStillAuthorized(share),
  );
}

export function twinSessionRoomIsReusable(
  session: LiveSessionRecord | null | undefined,
  shareId: string,
  workspaceId: string,
): session is LiveSessionRecord & { roomName: string } {
  const transport = session?.transport ?? (session?.provider === "synthesia" ? "livekit" : undefined);
  const reuseHumanRoom = session?.reuseHumanRoom ?? (session?.provider === "synthesia");
  return Boolean(
    session
    && transport === "livekit"
    && reuseHumanRoom
    && session.roomName
    && session.shareId === shareId
    && session.workspaceId === workspaceId
    && (session.status === "pending" || session.status === "active"),
  );
}
