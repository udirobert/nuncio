import { NextRequest, NextResponse } from "next/server";
import { synthesise, generateScript } from "@/lib/claude";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Rate limit
  const clientId = getClientId(request);
  const limit = checkRateLimit(clientId, "script", RATE_LIMITS.script);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Try again in ${limit.resetIn} seconds.` },
      {
        status: 429,
        headers: { "Retry-After": String(limit.resetIn) },
      }
    );
  }

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
