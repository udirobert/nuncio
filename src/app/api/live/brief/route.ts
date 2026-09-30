import { NextRequest, NextResponse } from "next/server";
import { getShareRecord } from "@/lib/share-store";
import { getLiveSessionStorageProvider } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rate-limit";
import { isLiveLinkAllowed, isLiveLinkEnabled } from "@/lib/live-link";
import { authorizeHandoffShare } from "@/lib/live-handoff";
import { hashLiveSessionToken } from "@/lib/live-session";
import { browserMutationAllowed } from "@/lib/call-request";
import { parseBriefDialogue } from "@/lib/live-call-brief";
import { draftLiveCallBrief } from "@/lib/live-call-brief-server";

const PRIVATE_HEADERS = { "Cache-Control": "no-store", Vary: "Cookie" };
const BRIEF_RATE_LIMIT = { maxRequests: 3, windowSeconds: 60 };

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    shareId?: string;
    sessionId?: string;
    syncToken?: string;
    consent?: unknown;
    messages?: unknown;
  } | null;

  if (!body || typeof body.shareId !== "string" || !body.shareId
    || typeof body.sessionId !== "string" || !body.sessionId
    || typeof body.syncToken !== "string" || !body.syncToken
    || body.consent !== true) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (!browserMutationAllowed(request, true)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: PRIVATE_HEADERS });
  }

  try {
    if (!isLiveLinkEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: PRIVATE_HEADERS });
    }

    const share = await getShareRecord(body.shareId);
    if (!share || share.deliveryMode !== "livelink" || !share.workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: PRIVATE_HEADERS });
    }
    if (!isLiveLinkAllowed({ workspaceId: share.workspaceId, senderEmail: share.senderEmail })) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: PRIVATE_HEADERS });
    }
    if (!await authorizeHandoffShare(request, share)) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: PRIVATE_HEADERS });
    }

    const sessionStorage = getLiveSessionStorageProvider();
    const sessionProofValid = (session: { shareId?: string; workspaceId?: string; status?: string; syncTokenHash?: string } | null) =>
      Boolean(session
        && session.shareId === body.shareId
        && session.workspaceId === share.workspaceId
        && (session.status === "pending" || session.status === "active")
        && hashLiveSessionToken(body.syncToken as string) === session.syncTokenHash);

    const session = await sessionStorage.get(body.sessionId);
    if (!sessionProofValid(session)) {
      return NextResponse.json({ error: "Invalid live session proof" }, { status: 403, headers: PRIVATE_HEADERS });
    }

    const dialogue = parseBriefDialogue(body.messages);
    if (!dialogue) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: PRIVATE_HEADERS });
    }

    const rateLimit = await checkRateLimit(`brief:${session!.id}`, "live.brief", BRIEF_RATE_LIMIT);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Drafting is temporarily unavailable", retryAfter: rateLimit.resetIn },
        { status: 429, headers: { ...PRIVATE_HEADERS, "Retry-After": String(rateLimit.resetIn) } },
      );
    }

    let brief;
    try {
      brief = await draftLiveCallBrief(dialogue);
    } catch {
      return NextResponse.json({ error: "Drafting is unavailable" }, { status: 503, headers: PRIVATE_HEADERS });
    }

    const freshSession = await sessionStorage.get(body.sessionId);
    if (!sessionProofValid(freshSession) || !await authorizeHandoffShare(request, share)) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: PRIVATE_HEADERS });
    }

    return NextResponse.json({ brief }, { headers: PRIVATE_HEADERS });
  } catch {
    return NextResponse.json({ error: "Drafting is unavailable" }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
