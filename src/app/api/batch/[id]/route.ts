import { NextRequest, NextResponse } from "next/server";
import {
  deleteBatchForWorkspace,
  getBatchForWorkspace,
  publicBatchView,
} from "@/lib/batch/queue";
import { readAccountSession } from "@/lib/auth/session";

const NO_STORE = { "Cache-Control": "no-store", Vary: "Cookie" } as const;

/**
 * A single batch. Scoped to the caller's workspace — a batch id is not a
 * capability, and an unauthenticated delete would let anyone destroy another
 * account's campaign.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = readAccountSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401, headers: NO_STORE });
  }

  const { id } = await params;
  const batch = await getBatchForWorkspace(id, session.workspaceId, session.email);
  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404, headers: NO_STORE });
  }
  return NextResponse.json(publicBatchView(batch), { headers: NO_STORE });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = readAccountSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401, headers: NO_STORE });
  }

  const { id } = await params;
  const deleted = await deleteBatchForWorkspace(id, session.workspaceId, session.email);
  if (!deleted) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
