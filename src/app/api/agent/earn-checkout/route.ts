/**
 * Agent earn-checkout endpoint — creates a Stripe Checkout session
 * for a prospect to pay for a booked meeting.
 *
 * This is the "earning" side of the autonomous agent: when a prospect
 * agrees to a meeting, the agent creates a checkout session and sends
 * the payment link. Revenue flows to the workspace's Stripe account.
 *
 * POST /api/agent/earn-checkout
 *   Body: { prospectEmail, meetingType, amount, prospectName?, shareId? }
 *   Returns: { checkoutUrl, sessionId }
 *
 * Reuses the same Stripe integration pattern as /api/checkout (DRY).
 * Uses STRIPE_SECRET_KEY env var — same as existing checkout route.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateAgentRequest } from "@/lib/agent-auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const MEETING_TYPE_LABELS: Record<string, string> = {
  consultation: "30-min consultation",
  demo: "Product demo",
  discovery: "Discovery call",
  strategy: "Strategy session",
};

export async function POST(request: NextRequest) {
  const auth = validateAgentRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { prospectEmail, meetingType, amount, prospectName, shareId } = body;

    if (!prospectEmail || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "prospectEmail and positive amount are required" },
        { status: 400 },
      );
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json(
        { error: "Stripe not configured — set STRIPE_SECRET_KEY" },
        { status: 503 },
      );
    }

    // Dynamic import — Stripe is only needed when earning is active
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey);

    const label = MEETING_TYPE_LABELS[meetingType] || meetingType || "Meeting";
    const description = `${label}${prospectName ? ` with ${prospectName}` : ""}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: description,
              metadata: {
                meetingType: meetingType || "meeting",
                shareId: shareId || "",
              },
            },
          },
          quantity: 1,
        },
      ],
      customer_email: prospectEmail,
      success_url: `${APP_URL}/v/${shareId || ""}?booked=true`,
      cancel_url: `${APP_URL}/v/${shareId || ""}?booked=cancel`,
      metadata: {
        type: "agent_meeting",
        workspaceId: auth.workspaceId,
        prospectEmail,
        prospectName: prospectName || "",
        shareId: shareId || "",
        meetingType: meetingType || "meeting",
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("[agent-earn-checkout] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 500 },
    );
  }
}
