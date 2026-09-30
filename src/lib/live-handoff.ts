import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import type { ShareRecord } from "@/lib/artifacts";
import { getHandoffStorageProvider, type HandoffRecord } from "@/lib/storage";
import type { WorkspaceAccount } from "@/lib/storage/types";
import { readAccountSession } from "@/lib/auth/session";
import {
  areCallRequestsEnabledForShare,
  isCallAvailabilityActive,
  isWorkspaceOwner,
} from "@/lib/call-request";
import { isLiveTwinReady } from "@/lib/live-avatar-providers";
import { resolveSchedulingProvider } from "@/lib/scheduling";
import { resolvePublicOrigin } from "@/lib/url";

export const HANDOFF_DEFAULT_TTL_MS = 24 * 60 * 60_000;
export const HANDOFF_MAX_TTL_MS = 168 * 60 * 60_000;
export const HANDOFF_COOKIE_PREFIX = "nuncio_handoff_";

const SAFE_SHARE_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function handoffCookieName(shareId: string): string | null {
  return SAFE_SHARE_ID.test(shareId) ? `${HANDOFF_COOKIE_PREFIX}${shareId}` : null;
}

export function mintHandoffToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashHandoffToken(token) };
}

export function hashHandoffToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function handoffTokenMatches(record: HandoffRecord, token: string): boolean {
  const presented = Buffer.from(hashHandoffToken(token));
  const expected = Buffer.from(record.tokenHash);
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}

export function isHandoffActive(record: HandoffRecord, now = new Date()): boolean {
  return !record.revokedAt && new Date(record.expiresAt).getTime() > now.getTime();
}

export async function getActiveHandoffForShare(
  share: ShareRecord,
  now = new Date(),
): Promise<{ record: HandoffRecord | null; protected: boolean }> {
  if (!share.handoffId) return { record: null, protected: false };
  const record = await getHandoffStorageProvider().get(share.handoffId);
  const active = Boolean(
    record
    && record.shareId === share.id
    && record.workspaceId === share.workspaceId
    && isHandoffActive(record, now),
  );
  return { record: active ? record : null, protected: true };
}

export function handoffCookieSecure(request: NextRequest): boolean {
  return process.env.NODE_ENV === "production" || resolvePublicOrigin(request).startsWith("https://");
}

export async function authorizeHandoffShare(request: NextRequest, share: ShareRecord): Promise<boolean> {
  const { record, protected: isProtected } = await getActiveHandoffForShare(share);
  if (!isProtected) return true;
  if (!record) return false;
  const cookieName = handoffCookieName(share.id);
  const presented = cookieName ? request.cookies.get(cookieName)?.value : undefined;
  if (presented && handoffTokenMatches(record, presented)) return true;
  const session = readAccountSession(request);
  if (session && record.workspaceId && await isWorkspaceOwner({ session, workspaceId: record.workspaceId })) {
    return true;
  }
  return false;
}

export async function handoffShareStillAuthorized(share: ShareRecord): Promise<boolean> {
  const { record, protected: isProtected } = await getActiveHandoffForShare(share);
  return !isProtected || Boolean(record);
}

export function validateHandoffBookingUrl(raw: string | null | undefined): string | null {
  return resolveSchedulingProvider(raw)?.url ?? null;
}

export type HandoffOptions = {
  twin: boolean;
  callRequestsEnabled: boolean;
  acceptingCalls: boolean;
  bookingUrl: string | null;
};

export type HandoffNextStep = "call" | "twin" | "book";

export function getHandoffOptions(
  share: Pick<ShareRecord, "workspaceId" | "senderEmail" | "anamAvatarId" | "anamVoiceId" | "bookingUrl">,
  workspace: WorkspaceAccount | null,
  active: boolean,
): HandoffOptions {
  const disabled: HandoffOptions = {
    twin: false,
    callRequestsEnabled: false,
    acceptingCalls: false,
    bookingUrl: null,
  };
  if (!active) return disabled;

  const twin = isLiveTwinReady({ workspace, share });

  const callRequestsEnabled = areCallRequestsEnabledForShare(share);
  return {
    twin,
    callRequestsEnabled,
    acceptingCalls: callRequestsEnabled && isCallAvailabilityActive(workspace),
    bookingUrl: validateHandoffBookingUrl(share.bookingUrl),
  };
}

export function effectiveHandoffNextStep(
  requested: HandoffNextStep,
  options: HandoffOptions,
): HandoffNextStep | null {
  const available: Record<HandoffNextStep, boolean> = {
    twin: options.twin,
    call: options.acceptingCalls,
    book: Boolean(options.bookingUrl),
  };
  if (available[requested]) return requested;
  if (options.twin) return "twin";
  if (options.bookingUrl) return "book";
  if (options.acceptingCalls) return "call";
  return null;
}
