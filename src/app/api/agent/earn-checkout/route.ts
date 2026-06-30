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
 *   Returns: { checkoutUrl, sessionId, customerId }
 *
 * Reuses existing Stripe customers by email lookup so repeat prospects
 * get a unified payment history. Uses an idempotency key derived from
 * shareId + meetingType to prevent duplicate sessions if the agent
 * calls this endpoint more than once for the same prospect meeting.
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

/**
 * Look up an existing Stripe customer by email. Returns the customer ID
 * if found, otherwise undefined (Stripe will create one implicitly from
 * customer_email during checkout).
 */
async function findCustomerByEmail(
  stripe: import("stripe").default,
  email: string,
): Promise<string | undefined> {
  const customers = await stripe.customers.list({
    email,
    limit: 1,
  });
  return customers.data[0]?.id;
}

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

    // Reuse existing Stripe customer for this email so repeat prospects
    // have a unified payment history and we can look them up later.
    const existingCustomerId = await findCustomerByEmail(stripe, prospectEmail);

    // Idempotency: if the agent calls earn-checkout twice for the same
    // shareId + meetingType, Stripe returns the same session instead of
    // creating a duplicate.
    const idempotencyKey = shareId
      ? `earn-checkout-${shareId}-${meetingType || "meeting"}`
      : undefined;

    const session = await stripe.checkout.sessions.create(
      {
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
        // Use existing customer if found, otherwise let Stripe create one
        // from the email.
        ...(existingCustomerId
          ? { customer: existingCustomerId }
          : { customer_email: prospectEmail }),
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
      },
      ...(idempotencyKey ? [{ idempotencyKey }] : []),
    );

    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
      customerId: existingCustomerId || (session.customer as string) || undefined,
    });
  } catch (error) {
    console.error("[agent-earn-checkout] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 500 },
    );
  }
}
