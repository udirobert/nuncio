import { NextRequest, NextResponse } from "next/server";
import { readAccountSession } from "@/lib/auth/session";
import { getAccountStorageProvider } from "@/lib/storage";
import { isLiveLinkEnabled } from "@/lib/live-link";
import { browserMutationAllowed } from "@/lib/call-request";

export async function GET(request: NextRequest) {
  const session = readAccountSession(request);
  if (!session) {
    return NextResponse.json({ senderBrief: null, senderName: null, plan: "trial" });
  }

  const provider = getAccountStorageProvider();
  const workspace = await provider.getWorkspace(session.workspaceId);
  if (!workspace) {
    return NextResponse.json({ senderBrief: null, senderName: null, plan: "trial" });
  }

  return NextResponse.json({
    senderBrief: workspace.lastSenderBrief || null,
    senderName: workspace.lastSenderName || null,
    senderBusiness: workspace.senderBusiness || null,
    senderBrand: workspace.senderBrand || null,
    senderPersonality: workspace.senderPersonality || null,
    senderAudience: workspace.senderAudience || null,
    senderOffer: workspace.senderOffer || null,
    senderProofPoints: workspace.senderProofPoints || null,
    playbookWants: workspace.playbookWants || null,
    playbookOffer: workspace.playbookOffer || null,
    playbookWiggleRoom: workspace.playbookWiggleRoom || null,
    playbookConstraints: workspace.playbookConstraints || null,
    bookingUrl: workspace.bookingUrl || null,
    anamAvatarId: workspace.anamAvatarId || null,
    anamVoiceId: workspace.anamVoiceId || null,
    synthesiaAvatarId: workspace.synthesiaAvatarId || null,
    liveVoiceId: workspace.liveVoiceId || null,
    // STRATEGY Phase 1: live link is the default primary artifact.
    deliveryMode: workspace.deliveryMode === "livelink" && !isLiveLinkEnabled()
      ? "video"
      : (workspace.deliveryMode || (isLiveLinkEnabled() ? "livelink" : "video")),
    plan: workspace.plan || (workspace.stripePlanType || "trial").toLowerCase(),
  });
}

export async function PATCH(request: NextRequest) {
  const session = readAccountSession(request);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!browserMutationAllowed(request, true)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { senderBrief, senderName, senderBusiness, senderBrand, senderPersonality, senderAudience, senderOffer, senderProofPoints, playbookWants, playbookOffer, playbookWiggleRoom, playbookConstraints, bookingUrl, deliveryMode, anamAvatarId, anamVoiceId, synthesiaAvatarId, liveVoiceId } = body;

  const provider = getAccountStorageProvider();
  const workspace = await provider.getWorkspace(session.workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }
  if (
    workspace.ownerUserId !== session.userId
    && (typeof synthesiaAvatarId === "string" || typeof liveVoiceId === "string")
  ) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const updates: Record<string, string> = {};
  if (typeof senderBrief === "string") updates.lastSenderBrief = senderBrief;
  if (typeof senderName === "string") updates.lastSenderName = senderName;
  if (typeof senderBusiness === "string") updates.senderBusiness = senderBusiness;
  if (typeof senderBrand === "string") updates.senderBrand = senderBrand;
  if (typeof senderPersonality === "string") updates.senderPersonality = senderPersonality;
  if (typeof senderAudience === "string") updates.senderAudience = senderAudience;
  if (typeof senderOffer === "string") updates.senderOffer = senderOffer;
  if (typeof senderProofPoints === "string") updates.senderProofPoints = senderProofPoints;
  if (typeof playbookWants === "string") updates.playbookWants = playbookWants;
  if (typeof playbookOffer === "string") updates.playbookOffer = playbookOffer;
  if (typeof playbookWiggleRoom === "string") updates.playbookWiggleRoom = playbookWiggleRoom;
  if (typeof playbookConstraints === "string") updates.playbookConstraints = playbookConstraints;
  if (typeof bookingUrl === "string") {
    const trimmed = bookingUrl.trim();
    if (!trimmed || /^https?:\/\//i.test(trimmed)) {
      updates.bookingUrl = trimmed;
    }
  }
  if (deliveryMode === "video" || (deliveryMode === "livelink" && isLiveLinkEnabled())) {
    updates.deliveryMode = deliveryMode;
  }
  if (typeof anamAvatarId === "string") updates.anamAvatarId = anamAvatarId;
  if (typeof anamVoiceId === "string") updates.anamVoiceId = anamVoiceId;
  if (typeof synthesiaAvatarId === "string") {
    const trimmed = synthesiaAvatarId.trim();
    if (!trimmed) {
      updates.synthesiaAvatarId = "";
    } else if (/^av_[A-Za-z0-9_-]{1,64}$/.test(trimmed)) {
      updates.synthesiaAvatarId = trimmed;
    } else {
      return NextResponse.json({ error: "synthesiaAvatarId must be an interactive avatar ID (av_*)" }, { status: 400 });
    }
  }
  if (typeof liveVoiceId === "string") {
    const trimmed = liveVoiceId.trim();
    if (!trimmed || /^[A-Za-z0-9_-]{1,64}$/.test(trimmed)) {
      updates.liveVoiceId = trimmed;
    } else {
      return NextResponse.json({ error: "liveVoiceId must be an ElevenLabs voice ID" }, { status: 400 });
    }
  }

  await provider.updateWorkspace(session.workspaceId, updates);

  return NextResponse.json({ ok: true });
}
