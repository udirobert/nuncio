import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { updateShareRecordByCustomerId } from "@/lib/share-store";
import {
  attachStripeCustomerToWorkspace,
  getWorkspaceForStripeCustomer,
  grantPlanCredits,
  updateWorkspaceSubscription,
  upsertBillingAccount,
} from "@/lib/billing/accounts";

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
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
        const purchaseType = session.metadata?.purchaseType || "subscription";
        const workspaceId = session.metadata?.workspaceId || session.client_reference_id || "";
        const userId = session.metadata?.userId || "";
        const email = session.customer_details?.email || session.customer_email;

        console.log(`[webhook] Checkout completed: customer=${customerId}, plan=${planType}, workspace=${workspaceId}, userId=${userId}, email=${email}, purchaseType=${purchaseType}`);

        if (workspaceId) {
          const workspace = await attachStripeCustomerToWorkspace({
            workspaceId,
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId || undefined,
            planType,
          });
          if (workspace) {
            const granted = await grantPlanCredits({
              workspace,
              planType,
              stripeEventId: event.id,
              reason: purchaseType === "credit_pack"
                ? "stripe_credit_pack_checkout_completed"
                : "stripe_subscription_checkout_completed",
            });
            console.log(`[webhook] Granted ${granted} checkout credits to workspace=${workspace.id}`);
          } else if (email) {
            console.log(`[webhook] Workspace ${workspaceId} not found, falling back to email upsert for ${email}`);
            const { user, workspace: ws } = await upsertBillingAccount({
              email,
              stripeCustomerId: customerId || undefined,
              stripeSubscriptionId: subscriptionId,
              planType,
            });
            const granted = await grantPlanCredits({
              workspace: ws,
              user,
              planType,
              stripeEventId: event.id,
              reason: purchaseType === "credit_pack"
                ? "stripe_credit_pack_checkout_completed"
                : "stripe_subscription_checkout_completed",
            });
            console.log(`[webhook] Granted ${granted} checkout credits via fallback to workspace=${ws.id}`);
          } else {
            console.warn(`[webhook] Workspace ${workspaceId} not found and no email available`);
          }
        } else if (email) {
          const { user, workspace } = await upsertBillingAccount({
            email,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            planType,
          });
          const granted = await grantPlanCredits({
            workspace,
            user,
            planType,
            stripeEventId: event.id,
            reason: purchaseType === "credit_pack"
              ? "stripe_credit_pack_checkout_completed"
              : "stripe_subscription_checkout_completed",
          });
          console.log(`[webhook] Granted ${granted} checkout credits to workspace=${workspace.id}`);
        } else {
          console.warn(`[webhook] Checkout completed without customer email: customer=${customerId}`);
        }

        // Legacy compatibility while share records are migrated away from billing state.
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
        const billingReason = (invoice as Stripe.Invoice & { billing_reason?: string }).billing_reason;

        console.log(`[webhook] Invoice paid: customer=${customerId}`);

        if (billingReason === "subscription_create") {
          console.log(`[webhook] Skipping initial subscription invoice grant for customer=${customerId}`);
          break;
        }

        const workspace = await getWorkspaceForStripeCustomer(customerId);
        if (workspace) {
          const granted = await grantPlanCredits({
            workspace,
            planType: workspace.stripePlanType || workspace.plan || "pro",
            stripeEventId: event.id,
            stripeInvoiceId: invoice.id,
            reason: "stripe_invoice_paid",
          });
          console.log(`[webhook] Granted ${granted} renewal credits to workspace=${workspace.id}`);
        } else {
          console.warn(`[webhook] No workspace found for paid invoice customer=${customerId}`);
        }

        // Legacy compatibility while share records are migrated away from billing state.
        await updateShareRecordByCustomerId(customerId, {
          plan: "pro",
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        console.log(`[webhook] Payment failed: customer=${customerId}`);

        await updateWorkspaceSubscription({
          customerId,
          plan: "free",
        });

        // Legacy compatibility while share records are migrated away from billing state.
        await updateShareRecordByCustomerId(customerId, {
          plan: "free",
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        console.log(`[webhook] Subscription cancelled: customer=${customerId}`);

        await updateWorkspaceSubscription({
          customerId,
          stripeSubscriptionId: undefined,
          plan: "free",
        });

        // Legacy compatibility while share records are migrated away from billing state.
        await updateShareRecordByCustomerId(customerId, {
          plan: "free",
          stripeSubscriptionId: undefined,
        });
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const sessionType = session.metadata?.type || "subscription";
        const workspaceId = session.metadata?.workspaceId || session.client_reference_id || "";

        console.log(`[webhook] Checkout session expired: session=${session.id}, type=${sessionType}, workspace=${workspaceId}`);

        // For agent meeting sessions, log the expired payment attempt so
        // the agent can follow up with a new session if appropriate.
        if (sessionType === "agent_meeting") {
          const prospectEmail = session.metadata?.prospectEmail || "";
          const meetingType = session.metadata?.meetingType || "";
          console.log(`[webhook] Agent meeting checkout expired: prospect=${prospectEmail}, meeting=${meetingType}, session=${session.id}`);
        }
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
