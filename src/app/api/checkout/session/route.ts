import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/checkout/session?id=cs_live_...
 *
 * Returns the client_secret and display details for an embedded
 * checkout session. This is called by the /checkout page to
 * initialize Stripe's embedded checkout form.
 *
 * The session must be in "open" status and have ui_mode=embedded.
 */
export async function GET(request: NextRequest) {
  const id = new URL(request.url).searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Missing session id" },
      { status: 400 },
    );
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 503 },
    );
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey);

    const session = await stripe.checkout.sessions.retrieve(id, {
      expand: ["line_items"],
    });

    if (session.status !== "open") {
      return NextResponse.json(
        { error: `Session is ${session.status}, not open` },
        { status: 400 },
      );
    }

    const lineItem = session.line_items?.data?.[0];

    return NextResponse.json({
      clientSecret: session.client_secret,
      amountTotal: session.amount_total,
      currency: session.currency,
      description: lineItem?.description,
      status: session.status,
    });
  } catch (error) {
    console.error("[checkout/session] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to retrieve session" },
      { status: 500 },
    );
  }
}
