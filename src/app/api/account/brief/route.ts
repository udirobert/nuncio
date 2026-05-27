import { NextRequest, NextResponse } from "next/server";
import { readAccountSession } from "@/lib/auth/session";
import { getAccountStorageProvider } from "@/lib/storage";

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
    plan: workspace.plan || (workspace.stripePlanType || "trial").toLowerCase(),
  });
}

export async function PATCH(request: NextRequest) {
  const session = readAccountSession(request);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { senderBrief, senderName, senderBusiness, senderBrand, senderPersonality, senderAudience, senderOffer, senderProofPoints } = body;

  const provider = getAccountStorageProvider();
  const workspace = await provider.getWorkspace(session.workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
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

  await provider.updateWorkspace(session.workspaceId, updates);

  return NextResponse.json({ ok: true });
}
