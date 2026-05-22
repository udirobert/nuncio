import { NextRequest, NextResponse } from "next/server";
import { readAccountSession } from "@/lib/auth/session";
import { getAccountStorageProvider } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const session = readAccountSession(request);
  if (!session) {
    return NextResponse.json({ senderBrief: null, senderName: null });
  }

  const provider = getAccountStorageProvider();
  const workspace = await provider.getWorkspace(session.workspaceId);
  if (!workspace) {
    return NextResponse.json({ senderBrief: null, senderName: null });
  }

  return NextResponse.json({
    senderBrief: workspace.lastSenderBrief || null,
    senderName: workspace.lastSenderName || null,
  });
}

export async function PATCH(request: NextRequest) {
  const session = readAccountSession(request);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { senderBrief, senderName } = body;

  const provider = getAccountStorageProvider();
  const workspace = await provider.getWorkspace(session.workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const updates: Record<string, string> = {};
  if (typeof senderBrief === "string") updates.lastSenderBrief = senderBrief;
  if (typeof senderName === "string") updates.lastSenderName = senderName;

  await provider.updateWorkspace(session.workspaceId, updates);

  return NextResponse.json({ ok: true });
}
