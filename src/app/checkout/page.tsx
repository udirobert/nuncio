"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";

/**
 * Embedded Stripe Checkout page — /checkout?session_id=cs_live_...
 *
 * Fetches the client_secret from our API, then mounts Stripe's
 * embedded checkout form directly on this page. This bypasses
 * the hosted checkout.stripe.com page (which requires Dashboard
 * activation) and renders the payment form in our own branded
 * layout.
 */

function CheckoutContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const missingSession = !sessionId;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [sessionDetails, setSessionDetails] = useState<{
    amount?: number;
    description?: string;
    currency?: string;
  } | null>(null);

  useEffect(() => {
    if (missingSession) return;

    let cancelled = false;

    async function initCheckout() {
      try {
        // Fetch the client_secret and session details from our API
        const res = await fetch(
          `/api/checkout/session?id=${encodeURIComponent(sessionId!)}`,
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load checkout session");
        }
        const data = await res.json();
        if (cancelled) return;
        setSessionDetails({
          amount: data.amountTotal,
          description: data.description,
          currency: data.currency,
        });

        // Load Stripe with the publishable key
        const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        if (!stripeKey) {
          throw new Error("Stripe publishable key not configured");
        }
        const stripe = await loadStripe(stripeKey);

        if (!stripe) {
          throw new Error("Failed to initialize Stripe");
        }

        // Initialize embedded checkout
        const checkout = await stripe.createEmbeddedCheckoutPage({
          clientSecret: data.clientSecret,
        });

        // Mount the checkout form
        if (cancelled) return;
        if (containerRef.current) {
          checkout.mount(containerRef.current);
          setStatus("ready");
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[checkout] Error:", err);
        setErrorMsg(
          err instanceof Error ? err.message : "Failed to load checkout",
        );
        setStatus("error");
      }
    }

    initCheckout();
    return () => { cancelled = true; };
  }, [sessionId, missingSession]);

  const formatAmount = (amount?: number, currency?: string) => {
    if (amount == null) return "";
    const symbol = currency === "usd" ? "$" : currency === "gbp" ? "£" : "";
    return `${symbol}${(amount / 100).toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-lg tracking-tight text-ink hover:text-ink-light transition-colors"
        >
          nuncio
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-[480px]">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight mb-2">
              Complete your payment
            </h1>
            {sessionDetails?.description && (
              <p className="text-sm text-ink-muted">
                {sessionDetails.description}
              </p>
            )}
            {sessionDetails?.amount != null && (
              <p className="text-2xl font-semibold text-ink mt-2">
                {formatAmount(sessionDetails.amount, sessionDetails.currency)}
              </p>
            )}
          </div>

          {/* Loading state */}
          {status === "loading" && !missingSession && (
            <div className="rounded-2xl border border-cream-dark bg-white/70 p-8 text-center">
              <div className="w-10 h-10 mx-auto rounded-full border-2 border-ink/20 border-t-ink animate-spin mb-3" />
              <p className="text-sm text-ink-muted">Loading secure checkout...</p>
            </div>
          )}

          {/* Error state */}
          {(status === "error" || missingSession) && (
            <div className="rounded-2xl border border-cream-dark bg-white/70 p-8 text-center">
              <p className="text-sm text-ink-muted mb-4">
                {missingSession ? "Missing session_id parameter" : errorMsg}
              </p>
              <Link
                href="/"
                className="btn-press inline-flex rounded-xl bg-ink text-cream px-5 py-2.5 text-sm font-medium"
              >
                Back to nuncio
              </Link>
            </div>
          )}

          {/* Stripe embedded checkout container */}
          {status !== "error" && !missingSession && (
            <div
              ref={containerRef}
              className="rounded-2xl overflow-hidden bg-white shadow-lg shadow-ink/10"
            />
          )}

          {/* Trust footer */}
          <p className="text-center text-[11px] text-ink-faint mt-6">
            Secured by Stripe · Your payment information is encrypted
          </p>
        </div>
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-cream flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-ink/20 border-t-ink animate-spin" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
