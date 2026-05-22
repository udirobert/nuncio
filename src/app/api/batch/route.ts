import { NextRequest, NextResponse } from "next/server";
import { createBatch, listBatches, getBatch } from "@/lib/batch/queue";
import { processBatch } from "@/lib/batch/processor";
import { readAccountSession } from "@/lib/auth/session";

export async function GET() {
  return NextResponse.json(await listBatches());
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
  const creatorEmail = session?.email;

  const batch = await createBatch({ name, urls, senderBrief, senderName, creatorEmail, webhookUrl });

  processBatch(batch.id, request).catch((err) => {
    console.error(`[batch] Processing failed for ${batch.id}:`, err);
  });

  return NextResponse.json(batch, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const batch = await getBatch(id);
  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  processBatch(id, request).catch((err) => {
    console.error(`[batch] Re-processing failed for ${id}:`, err);
  });

  return NextResponse.json({ ok: true });
}
