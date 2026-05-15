import { NextRequest, NextResponse } from "next/server";
import { getShareRecord } from "@/lib/share-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = getShareRecord(id);

  if (!record) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }

  return NextResponse.json(record);
}