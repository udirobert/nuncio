import { NextRequest, NextResponse } from "next/server";
import { getShareRecord } from "@/lib/share-store";
import { getHandoffStorageProvider } from "@/lib/storage";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";
import { browserMutationAllowed } from "@/lib/call-request";
import { isLiveLinkAllowed, isLiveLinkEnabled } from "@/lib/live-link";
import {
  handoffCookieName,
  handoffCookieSecure,
  handoffTokenMatches,
  isHandoffActive,
} from "@/lib/live-handoff";

const NO_STORE = { "Cache-Control": "no-store" };

type RouteContext = { params: Promise<{ shareId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isLiveLinkEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  if (!browserMutationAllowed(request, true)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  }
  const { shareId } = await context.params;
  const share = await getShareRecord(shareId);
  if (
    !share?.handoffId
    || share.deliveryMode !== "livelink"
    || !isLiveLinkAllowed({ workspaceId: share.workspaceId, senderEmail: share.senderEmail })
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }

  const rateLimit = await checkRateLimit(getClientId(request), "live.handoffAccess", RATE_LIMITS.live);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rateLimit.resetIn },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(rateLimit.resetIn) } },
    );
  }

  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  if (typeof body?.token !== "string" || !body.token || body.token.length > 256) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }

  const record = await getHandoffStorageProvider().get(share.handoffId);
  const cookieName = handoffCookieName(share.id);
  if (
    !cookieName
    || !record
    || record.shareId !== share.id
    || record.workspaceId !== share.workspaceId
    || !isHandoffActive(record)
    || !handoffTokenMatches(record, body.token)
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }

  const maxAgeSeconds = Math.max(
    0,
    Math.floor((new Date(record.expiresAt).getTime() - Date.now()) / 1000),
  );
  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  response.cookies.set(cookieName, body.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: handoffCookieSecure(request),
    path: "/",
    maxAge: maxAgeSeconds,
  });
  return response;
}
