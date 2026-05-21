import { NextRequest, NextResponse } from "next/server";
import { createVideo } from "@/lib/heygen";
import { validateScript } from "@/lib/validation";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";
import {
  commitCreditReservation,
  estimateCreditCost,
  getCreditBalance,
  getCreditSubject,
  InsufficientCreditsError,
  refundCreditReservation,
  reserveCredits,
} from "@/lib/billing/credits";

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

  const { script, assetUrls, recipientName, customization } = await request.json();

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

  const subject = getCreditSubject(request);
  const renderCreditCost = estimateCreditCost("video.render");
  let reservationId: string | undefined;

  try {
    const reservation = await reserveCredits({
      subject,
      action: "video.render",
      amount: renderCreditCost,
      reason: "Render personalized outreach video",
      provider: "heygen",
    });
    reservationId = reservation.id;

    const result = await createVideo(script, assetUrls, recipientName, customization);
    await commitCreditReservation(reservation.id);

    return NextResponse.json(
      {
        ...result,
        credits: {
          action: "video.render",
          charged: renderCreditCost,
          balanceAfter: getCreditBalance(subject),
          mode: reservation.status === "shadow" ? "shadow" : "enforced",
        },
      },
      {
        headers: {
          "X-Nuncio-Credits-Charged": String(renderCreditCost),
          "X-Nuncio-Credits-Balance": String(getCreditBalance(subject)),
        },
      }
    );
  } catch (error) {
    if (reservationId) {
      await refundCreditReservation(reservationId);
    }

    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: error.message,
          requiredCredits: error.required,
          availableCredits: error.available,
        },
        { status: 402 }
      );
    }

    throw error;
  }
}
