import { NextRequest, NextResponse } from "next/server";
import { readAccountSession } from "@/lib/auth/session";
import { getAccountStorageProvider } from "@/lib/storage";
import { captureServerEvent } from "@/lib/analytics-server";
import { normalizeViralRef } from "@/lib/viral-ref";

export const runtime = "nodejs";

/**
 * Viral-loop attribution (STRATEGY S6): the dashboard posts the ?ref= invite
 * stored in localStorage once, right after signup. First-touch is immutable —
 * a workspace that already has referredBy never overwrites it.
 */

export async function POST(request: NextRequest) {
  const session = readAccountSession(request);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const ref = normalizeViralRef(body.ref);
  if (!ref) {
    return NextResponse.json({ error: "Invalid ref" }, { status: 400 });
  }

  const provider = getAccountStorageProvider();
  const workspace = await provider.getWorkspace(session.workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }
  if (workspace.referredBy === ref) {
    return NextResponse.json({ ok: true, attributed: false, alreadyAttributed: true });
  }
  if (workspace.referredBy) {
    return NextResponse.json({ ok: true, attributed: false });
  }

  await provider.updateWorkspace(workspace.id, { referredBy: ref });
  captureServerEvent({
    distinctId: session.email,
    event: "referred_signup",
    properties: {
      ref,
      source: ref.startsWith("live-") ? "live" : "share",
      workspace_id: workspace.id,
    },
  });

  return NextResponse.json({ ok: true, attributed: true });
}
