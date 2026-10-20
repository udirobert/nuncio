import { NextRequest, NextResponse } from "next/server";
import { validateAgentRequest } from "@/lib/agent-auth";
import { getAccountStorageProvider, getShareStorageProvider } from "@/lib/storage";
import { isLiveLinkAllowed } from "@/lib/live-link";
import { getHandoffOptions } from "@/lib/live-handoff";
import { absoluteUrl } from "@/lib/url";
import { sendLiveInviteEmail } from "@/lib/email";
import { checkPre, applyPost } from "@/lib/governance/service";
import { captureFunnelEvent } from "@/lib/funnel";
import type { ShareRecord } from "@/lib/artifacts";
import { normalizeCanAnswer } from "@/lib/sender-proof";

const NO_STORE = { "Cache-Control": "no-store" };
const TOOL = "agent.live-invite";

/**
 * Reply-to-live escalation.
 *
 * A prospect replied to the sender's first touch saying they are interested.
 * This endpoint upgrades that same link into a live conversation and emails
 * the prospect the front door: the sender's disclosed AI representative,
 * answering from the playbook, with the human one step away.
 *
 * The share record is upgraded in place — the recorded video stays on it as
 * the fallback artifact — so the sender's inbox keeps one relationship
 * rather than two rows for the same person.
 *
 * POST /api/agent/live-invite
 *   Body: { shareId, prospectEmail, prospectName? }
 *   Returns: { shareId, liveUrl, emailed }
 */
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

  let body: { shareId?: string; prospectEmail?: string; prospectName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400, headers: NO_STORE });
  }

  const shareId = typeof body.shareId === "string" ? body.shareId.trim() : "";
  const prospectEmail = typeof body.prospectEmail === "string" ? body.prospectEmail.trim() : "";
  if (!shareId || !prospectEmail) {
    return NextResponse.json(
      { error: "shareId and prospectEmail are required" },
      { status: 400, headers: NO_STORE },
    );
  }

  const workspace = await getAccountStorageProvider().getWorkspace(auth.workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404, headers: NO_STORE });
  }

  const shareProvider = getShareStorageProvider();
  const share = await shareProvider.get(shareId);
  if (!share || (share.workspaceId && share.workspaceId !== workspace.id)) {
    return NextResponse.json({ error: "Share not found" }, { status: 404, headers: NO_STORE });
  }

  // The escalation only makes sense if the sender can actually hold a live
  // conversation. Fail closed rather than emailing a dead link.
  if (!isLiveLinkAllowed({ workspaceId: workspace.id })) {
    return NextResponse.json(
      { error: "LiveLink is not enabled for this workspace" },
      { status: 404, headers: NO_STORE },
    );
  }
  const options = getHandoffOptions(share, workspace, true);
  if (!options.twin) {
    return NextResponse.json(
      { error: "No live representative is configured for this workspace — set one up first" },
      { status: 409, headers: NO_STORE },
    );
  }

  const subject = { class: "agent" as const, workspaceId: workspace.id };
  const pre = await checkPre(subject, TOOL, { shareId, prospectEmail });
  if (pre.decision === "deny") {
    return NextResponse.json({ error: pre.reason || "Blocked by policy" }, { status: 403, headers: NO_STORE });
  }
  if (pre.decision === "require_approval") {
    return NextResponse.json(
      { error: pre.reason || "Approval required", approvalRequired: true },
      { status: 409, headers: NO_STORE },
    );
  }

  const liveUrl = absoluteUrl(`/live/${share.id}`, request);
  const post = await applyPost(
    subject,
    TOOL,
    { liveUrl, prospectEmail },
    { shareId },
  );
  const safeUrl = post.value.liveUrl;

  // Upgrade the share in place: the live link is the front door, the
  // recorded video (if any) stays as the fallback artifact.
  const updated: ShareRecord = {
    ...share,
    deliveryMode: "livelink",
    senderName: share.senderName || workspace.lastSenderName || undefined,
    bookingUrl: share.bookingUrl || workspace.bookingUrl || undefined,
  };
  await shareProvider.update(updated);

  const canAnswer = normalizeCanAnswer(workspace.senderCanAnswer);
  await sendLiveInviteEmail({
    to: prospectEmail,
    senderName: updated.senderName || workspace.lastSenderName || "The sender",
    liveUrl: safeUrl,
    canAnswer,
    bookingUrl: updated.bookingUrl,
  });

  captureFunnelEvent({
    workspaceId: workspace.id,
    shareId: updated.id,
    event: "first_touch_sent",
    properties: { delivery_mode: "livelink", mode: updated.mode },
  });

  return NextResponse.json(
    { shareId: updated.id, liveUrl: safeUrl, emailed: true },
    { headers: NO_STORE },
  );
}
