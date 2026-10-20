import { NextRequest, NextResponse } from "next/server";
import {
  createBatch,
  getBatchForWorkspace,
  listBatchesForWorkspace,
  publicBatchView,
} from "@/lib/batch/queue";
import { processBatch } from "@/lib/batch/processor";
import { readAccountSession } from "@/lib/auth/session";

const NO_STORE = { "Cache-Control": "no-store", Vary: "Cookie" } as const;

/**
 * Batch campaigns.
 *
 * A batch holds a prospect list, the sender's brief, the creator's email and
 * a webhook URL. None of that is readable by another account, so every route
 * here requires a session and is scoped to the caller's workspace.
 */
export async function GET(request: NextRequest) {
  const session = readAccountSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401, headers: NO_STORE });
  }
  const batches = await listBatchesForWorkspace(session.workspaceId, session.email);
  return NextResponse.json(batches.map(publicBatchView), { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const { name, urls, senderBrief, senderName, webhookUrl } = await request.json();

  if (!name || !urls || !Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json(
      { error: "name and urls (non-empty array) are required" },
      { status: 400 }
    );
  }

  if (!senderBrief) {
    return NextResponse.json(
      { error: "senderBrief is required" },
      { status: 400 }
    );
  }

  const session = readAccountSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401, headers: NO_STORE });
  }

  const batch = await createBatch({
    name,
    urls,
    senderBrief,
    senderName,
    creatorEmail: session.email,
    workspaceId: session.workspaceId,
    webhookUrl,
  });

  processBatch(batch.id, request).catch((err) => {
    console.error(`[batch] Processing failed for ${batch.id}:`, err);
  });

  return NextResponse.json(publicBatchView(batch), { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const session = readAccountSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401, headers: NO_STORE });
  }

  const batch = await getBatchForWorkspace(id, session.workspaceId, session.email);
  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  processBatch(id, request).catch((err) => {
    console.error(`[batch] Processing failed for ${id}:`, err);
  });

  return NextResponse.json(publicBatchView(batch));
}
