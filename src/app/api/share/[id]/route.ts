import { NextRequest, NextResponse } from "next/server";
import { getShareRecord, updateShareRecord } from "@/lib/share-store";
import { signRecordAssets } from "@/lib/storage/media-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await getShareRecord(id);

  if (!record) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }

  // Resolve private B2 asset URLs to presigned download URLs
  const signed = await signRecordAssets(record);

  return NextResponse.json(signed);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const updates = await request.json();

  const record = await updateShareRecord(id, updates);

  if (!record) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }

  return NextResponse.json(record);
}