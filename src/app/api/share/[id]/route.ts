import { NextRequest, NextResponse } from "next/server";
import { getShareRecord, updateShareRecord } from "@/lib/share-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await getShareRecord(id);

  if (!record) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }

  return NextResponse.json(record);
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