import { NextRequest, NextResponse } from "next/server";
import { getVideoStatus } from "@/lib/heygen";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await getVideoStatus(id);
  return NextResponse.json(result);
}
