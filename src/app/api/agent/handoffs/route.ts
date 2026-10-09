import { NextRequest, NextResponse } from "next/server";
import { validateAgentRequest } from "@/lib/agent-auth";
import {
  checkPre,
  consumeApprovalGrant,
  requestApproval,
} from "@/lib/governance/service";
import {
  getAccountStorageProvider,
  getHandoffStorageProvider,
  getShareStorageProvider,
} from "@/lib/storage";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";
import { isLiveLinkAllowed } from "@/lib/live-link";
import { absoluteUrl } from "@/lib/url";
import {
  HANDOFF_DEFAULT_TTL_MS,
  HANDOFF_MAX_TTL_MS,
  effectiveHandoffNextStep,
  getHandoffOptions,
  mintHandoffToken,
  validateHandoffBookingUrl,
} from "@/lib/live-handoff";
import type { ShareRecord } from "@/lib/artifacts";
import type { HandoffRecord } from "@/lib/storage/types";

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_SUMMARY_CHARS = 2_000;
const MAX_LIST_ITEMS = 8;
const MAX_ITEM_CHARS = 200;
const NEXT_STEPS = new Set(["call", "twin", "book"]);

export async function POST(request: NextRequest) {
  const auth = validateAgentRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  if (!process.env.NUNCIO_AGENT_WORKSPACE_ID) {
    return NextResponse.json(
      { error: "NUNCIO_AGENT_WORKSPACE_ID is required — the agent token must be bound to one workspace" },
      { status: 503, headers: NO_STORE },
    );
  }
  const workspace = await getAccountStorageProvider().getWorkspace(auth.workspaceId);
  if (!workspace?.ownerUserId) {
    return NextResponse.json({ error: "Workspace is not configured" }, { status: 404, headers: NO_STORE });
  }
  if (!isLiveLinkAllowed({ workspaceId: workspace.id })) {
    return NextResponse.json({ error: "LiveLink is not enabled for this workspace" }, { status: 404, headers: NO_STORE });
  }

  const rateLimit = await checkRateLimit(
    `${auth.workspaceId}:${getClientId(request)}`,
    "agent.handoffs",
    RATE_LIMITS.agentLite,
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rateLimit.resetIn },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(rateLimit.resetIn) } },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    recipientName?: unknown;
    summary?: unknown;
    interests?: unknown;
    unansweredQuestions?: unknown;
    recommendedNextStep?: unknown;
    expiresInHours?: unknown;
    sourceShareId?: unknown;
  } | null;

  const recipientName = typeof body?.recipientName === "string" ? body.recipientName.trim() : "";
  if (!recipientName || recipientName.length > 120) {
    return NextResponse.json({ error: "recipientName is required (1–120 characters)" }, { status: 400, headers: NO_STORE });
  }
  if (body?.summary !== undefined && (typeof body.summary !== "string" || body.summary.length > MAX_SUMMARY_CHARS)) {
    return NextResponse.json({ error: "summary must be a string of at most 2000 characters" }, { status: 400, headers: NO_STORE });
  }
  const cleanList = (value: unknown): string[] | null => {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) return null;
    const items = value.map((item) => (typeof item === "string" ? item.trim() : ""));
    if (items.some((item) => !item || item.length > MAX_ITEM_CHARS)) return null;
    return items;
  };
  const interests = cleanList(body?.interests);
  const unansweredQuestions = cleanList(body?.unansweredQuestions);
  if (!interests || !unansweredQuestions) {
    return NextResponse.json(
      { error: "interests and unansweredQuestions must be arrays of at most 8 non-empty strings (≤200 chars each)" },
      { status: 400, headers: NO_STORE },
    );
  }
  const recommendedNextStep = body?.recommendedNextStep === undefined
    ? "twin"
    : typeof body.recommendedNextStep === "string" && NEXT_STEPS.has(body.recommendedNextStep)
      ? body.recommendedNextStep as "call" | "twin" | "book"
      : null;
  if (!recommendedNextStep) {
    return NextResponse.json({ error: "recommendedNextStep must be call, twin, or book" }, { status: 400, headers: NO_STORE });
  }
  let ttlMs = HANDOFF_DEFAULT_TTL_MS;
  if (body?.expiresInHours !== undefined) {
    const hours = body.expiresInHours;
    if (typeof hours !== "number" || !Number.isInteger(hours) || hours < 1 || hours * 60 * 60_000 > HANDOFF_MAX_TTL_MS) {
      return NextResponse.json({ error: "expiresInHours must be an integer between 1 and 168" }, { status: 400, headers: NO_STORE });
    }
    ttlMs = hours * 60 * 60_000;
  }

  let source: ShareRecord | null = null;
  if (body?.sourceShareId !== undefined) {
    if (typeof body.sourceShareId !== "string" || !body.sourceShareId) {
      return NextResponse.json({ error: "sourceShareId must be a string" }, { status: 400, headers: NO_STORE });
    }
    source = await getShareStorageProvider().get(body.sourceShareId);
    if (!source || source.workspaceId !== workspace.id) {
      return NextResponse.json({ error: "sourceShareId must reference a share owned by this workspace" }, { status: 400, headers: NO_STORE });
    }
  }

  const bookingUrl = validateHandoffBookingUrl(workspace.bookingUrl);

  // Governance pre-hook: minting a bearer invitation is recorded in the
  // audit trail even though no seeded rule gates it yet — the row is what
  // lets a future deny/require_approval rule act on real traffic history.
  const handoffSubject = { class: "agent" as const, workspaceId: auth.workspaceId };
  const handoffPayload = {
    recommendedNextStep,
    sourceShareId: (body?.sourceShareId as string | undefined) ?? null,
  };
  const handoffGrant = request.headers.get("x-nuncio-approval-grant")?.trim();
  if (handoffGrant) {
    const consumed = await consumeApprovalGrant(handoffGrant, "agent.handoffs", handoffPayload);
    if (!consumed.ok) {
      return NextResponse.json({ error: consumed.error }, { status: 403, headers: NO_STORE });
    }
  } else {
    const handoffPre = await checkPre(handoffSubject, "agent.handoffs", handoffPayload);
    if (handoffPre.decision === "deny") {
      return NextResponse.json(
        { error: handoffPre.reason || "Denied by policy" },
        { status: 403, headers: NO_STORE },
      );
    }
    if (handoffPre.decision === "require_approval") {
      const req = await requestApproval({
        subject: handoffSubject,
        tool: "agent.handoffs",
        payload: handoffPayload,
        summary: `Handoff invitation for ${recipientName}`,
        callbackUrl: request.headers.get("x-nuncio-approval-callback") ?? undefined,
      });
      if (!req.ok) {
        return NextResponse.json(
          { error: req.error },
          { status: req.status, headers: NO_STORE },
        );
      }
      const approval = req.approval;
      return NextResponse.json(
        {
          status: "pending_approval",
          approvalId: approval.id,
          deduplicated: req.deduplicated,
          reason: handoffPre.reason,
          retry:
            "Once approved, POST the same body again with header x-nuncio-approval-grant: <token>",
          callback:
            "Send x-nuncio-approval-callback: <url> on this request to have the grant POSTed to you on approval",
          approvalStatusUrl: `/api/agent/approvals?id=${approval.id}`,
        },
        { status: 202, headers: NO_STORE },
      );
    }
  }

  const handoffId = crypto.randomUUID();
  const { token, hash } = mintHandoffToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  try {
    const share = await getShareStorageProvider().create({
      workspaceId: workspace.id,
      senderName: workspace.lastSenderName || workspace.name,
      recipientName,
      deliveryMode: "livelink",
      privacy: "private",
      profile: source?.profile,
      language: source?.language,
      videoUrl: source?.videoUrl,
      videoId: source?.videoId,
      bookingUrl: bookingUrl ?? undefined,
      handoffId,
    });

    const record: HandoffRecord = {
      id: handoffId,
      shareId: share.id,
      workspaceId: workspace.id,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      tokenHash: hash,
      context: {
        summary: (body?.summary as string | undefined) ?? "",
        interests,
        unansweredQuestions,
      },
      recommendedNextStep,
    };
    await getHandoffStorageProvider().create(record);

    const options = getHandoffOptions(share, workspace, true);
    return NextResponse.json(
      {
        handoffId,
        shareId: share.id,
        inviteUrl: `${absoluteUrl(`/live/${share.id}`, request)}#handoff=${token}`,
        expiresAt: expiresAt.toISOString(),
        options,
        recommendedNextStep: effectiveHandoffNextStep(recommendedNextStep, options),
      },
      { status: 201, headers: NO_STORE },
    );
  } catch {
    return NextResponse.json({ error: "Unable to create the invitation" }, { status: 500, headers: NO_STORE });
  }
}

export async function GET(request: NextRequest) {
  const auth = validateAgentRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  if (!process.env.NUNCIO_AGENT_WORKSPACE_ID) {
    return NextResponse.json({ error: "NUNCIO_AGENT_WORKSPACE_ID is required" }, { status: 503, headers: NO_STORE });
  }
  const records = await getHandoffStorageProvider().listByWorkspace(auth.workspaceId, 50);
  const now = new Date();
  return NextResponse.json(
    {
      handoffs: records.map((record) => ({
        handoffId: record.id,
        shareId: record.shareId,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        revoked: Boolean(record.revokedAt),
        active: !record.revokedAt && new Date(record.expiresAt).getTime() > now.getTime(),
        recommendedNextStep: record.recommendedNextStep,
      })),
      scope: "latest 50 handoffs in this workspace",
    },
    { headers: NO_STORE },
  );
}
