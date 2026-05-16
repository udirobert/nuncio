import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { updateShareRecordByCustomerId } from "@/lib/share-store";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature") || "";

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log("[webhook] Received event:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const planType = session.metadata?.planType || "pro";

        console.log(`[webhook] Checkout completed: customer=${customerId}, plan=${planType}`);

        // Update the user's plan in the database
        await updateShareRecordByCustomerId(customerId, {
          plan: planType as "pro",
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
        });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        console.log(`[webhook] Invoice paid: customer=${customerId}`);

        // Subscription renewed - ensure plan is still active
        await updateShareRecordByCustomerId(customerId, {
          plan: "pro",
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        console.log(`[webhook] Payment failed: customer=${customerId}`);

        // Downgrade to free on payment failure
        await updateShareRecordByCustomerId(customerId, {
          plan: "free",
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        console.log(`[webhook] Subscription cancelled: customer=${customerId}`);

        // User cancelled - downgrade to free
        await updateShareRecordByCustomerId(customerId, {
          plan: "free",
          stripeSubscriptionId: undefined,
        });
        break;
      }

      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[webhook] Error processing event:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}