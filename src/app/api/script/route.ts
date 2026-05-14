import { NextRequest, NextResponse } from "next/server";
import { synthesise, generateScript } from "@/lib/claude";

export async function POST(request: NextRequest) {
  const { enrichment, senderBrief } = await request.json();

  if (!enrichment || !Array.isArray(enrichment) || enrichment.length === 0) {
    return NextResponse.json(
      { error: "Enrichment data is required" },
      { status: 400 }
    );
  }

  const profile = await synthesise(enrichment);
  const script = await generateScript(profile, senderBrief);

  return NextResponse.json({ profile, script });
}
