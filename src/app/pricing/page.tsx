"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";

const PLANS = [
  {
    id: "pro-monthly",
    name: "Pro Monthly",
    price: "$29",
    period: "/month",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID || "",
    features: [
      "AI-powered video narratives",
      "LinkedIn / X profile enrichment",
      "Custom script generation",
      "HeyGen avatar rendering",
      "Melius canvas studio",
      "Share pages with captions",
    ],
  },
  {
    id: "pro-annual",
    name: "Pro Annual",
    price: "$290",
    period: "/year",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID || "",
    highlight: "Best value",
    features: [
      "Everything in Pro Monthly",
      "2 months free",
      "Priority generation queue",
    ],
  },
];

function PricingContent() {
  const [loading, setLoading] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  async function handleCheckout(priceId: string, planType: string) {
    if (!priceId) {
      alert("Stripe not configured. Add price IDs to env.");
      return;
    }

    setLoading(planType);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, planType }),
      });
      const { url } = await res.json();
      if (url) window.location.assign(url);
    } catch {
      alert("Checkout failed. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full pt-24">
      <div className="text-center mb-10">
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight mb-3">
          Pricing
        </h1>
        <p className="text-ink-muted text-sm max-w-md mx-auto">
          One plan, no surprises. Cancel anytime.
        </p>
      </div>

      {success && (
        <div className="max-w-md mx-auto mb-8 p-4 rounded-xl bg-success-soft border border-success/20 text-center">
          <p className="text-sm font-medium text-success">Subscription successful! Welcome to nuncio Pro.</p>
        </div>
      )}

      {canceled && (
        <div className="max-w-md mx-auto mb-8 p-4 rounded-xl bg-warm-soft border border-warm/20 text-center">
          <p className="text-sm font-medium text-warm">Checkout canceled. No charges were made.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-2xl border p-8 bg-white transition-all hover:shadow-md ${
              plan.highlight ? "border-accent ring-1 ring-accent/20" : "border-cream-dark"
            }`}
          >
            {plan.highlight && (
              <span className="text-[10px] uppercase tracking-widest font-medium text-accent bg-accent-soft px-2 py-0.5 rounded-full">
                {plan.highlight}
              </span>
            )}

            <div className="mt-4 flex items-baseline gap-1">
              <span className="font-[family-name:var(--font-display)] text-4xl tracking-tight">
                {plan.price}
              </span>
              <span className="text-sm text-ink-muted">{plan.period}</span>
            </div>

            <p className="text-sm font-medium text-ink mt-2 mb-4">{plan.name}</p>

            <ul className="space-y-2 mb-8">
              {plan.features.map((f) => (
                <li key={f} className="text-sm text-ink-muted flex items-center gap-2">
                  <span className="text-success">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout(plan.priceId, plan.id)}
              disabled={loading !== null}
              className="btn-press w-full rounded-xl bg-ink text-cream py-3 text-sm font-medium disabled:opacity-40 hover:bg-ink-light transition-colors"
            >
              {loading === plan.id ? "Redirecting..." : "Subscribe"}
            </button>
          </div>
        ))}
      </div>

      <p className="text-center text-[11px] text-ink-faint mt-8">
        Test mode — no real charges will be made. Use card number 4242 4242 4242 4242.
      </p>
    </main>
  );
}

export default function PricingPage() {
  return (
    <>
      <Header stage="input" />
      <Suspense>
        <PricingContent />
      </Suspense>
    </>
  );
}
