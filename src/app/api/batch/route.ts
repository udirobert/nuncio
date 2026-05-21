import { NextRequest, NextResponse } from "next/server";
import { createBatch, listBatches } from "@/lib/batch/queue";

export async function GET() {
  return NextResponse.json(listBatches());
}

export async function POST(request: NextRequest) {
  const { name, urls, senderBrief, senderName } = await request.json();

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

  const batch = createBatch({ name, urls, senderBrief, senderName });
  return NextResponse.json(batch, { status: 201 });
}
