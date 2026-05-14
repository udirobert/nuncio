import { NextRequest, NextResponse } from "next/server";
import { createVideo } from "@/lib/heygen";
import { validateScript } from "@/lib/validation";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Rate limit — video is the most expensive operation
  const clientId = getClientId(request);
  const limit = checkRateLimit(clientId, "video", RATE_LIMITS.video);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Rate limited — max ${RATE_LIMITS.video.maxRequests} videos per minute. Try again in ${limit.resetIn}s.` },
      {
        status: 429,
        headers: { "Retry-After": String(limit.resetIn) },
      }
    );
  }

  const { script, assetUrls, recipientName } = await request.json();

  if (!script) {
    return NextResponse.json(
      { error: "Script is required" },
      { status: 400 }
    );
  }

  // Validate script word count before burning HeyGen credits
  const scriptValidation = validateScript(script);
  if (!scriptValidation.valid) {
    return NextResponse.json(
      { error: scriptValidation.error, wordCount: scriptValidation.wordCount },
      { status: 400 }
    );
  }

  const result = await createVideo(script, assetUrls, recipientName);
  return NextResponse.json(result);
}
