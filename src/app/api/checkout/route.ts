import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { readAccountSession } from "@/lib/auth/session";
import { getAccountStorageProvider } from "@/lib/storage";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
  try {
    const { priceId, planType, mode } = await request.json();

    if (!priceId || !planType) {
      return NextResponse.json(
        { error: "priceId and planType are required" },
        { status: 400 }
      );
    }

    const checkoutMode = mode === "payment" ? "payment" : "subscription";
    const accountSession = readAccountSession(request);
    const summary = accountSession
      ? await getAccountStorageProvider().getCreditSummary(accountSession.workspaceId)
      : null;
    const stripeCustomerId = summary?.workspace.stripeCustomerId;

    // Create a Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: checkoutMode,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${APP_URL}/pricing?success=true&plan=${planType}`,
      cancel_url: `${APP_URL}/pricing?canceled=true`,
      ...(stripeCustomerId
        ? { customer: stripeCustomerId }
        : accountSession?.email
          ? { customer_email: accountSession.email }
          : {}),
      client_reference_id: accountSession?.workspaceId,
      metadata: {
        planType,
        purchaseType: checkoutMode === "payment" ? "credit_pack" : "subscription",
        workspaceId: accountSession?.workspaceId || "",
        userId: accountSession?.userId || "",
      },
      ...(checkoutMode === "subscription"
        ? {
            subscription_data: {
              metadata: {
                planType,
                workspaceId: accountSession?.workspaceId || "",
                userId: accountSession?.userId || "",
              },
            },
          }
        : {}),
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[checkout] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 500 }
    );
  }
}
