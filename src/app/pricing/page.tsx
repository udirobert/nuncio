"use client";

import { Suspense, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";

const MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID || "";
const ANNUAL_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID || "";

const FEATURES = [
  { label: "Unlimited Narratives", desc: "Generate as many video scripts as you need" },
  { label: "Premium Profile Intel", desc: "Structured context from LinkedIn & X" },
  { label: "High-Fidelity Rendering", desc: "Pro-grade HeyGen voice & avatar clones" },
  { label: "Advanced Canvas Access", desc: "Full control over the Melius creative studio" },
  { label: "Custom Branded Pages", desc: "Host videos on your own branded share pages" },
  { label: "Smart Captions", desc: "Multi-language Speechmatics subtitles" },
  { label: "Priority Rendering", desc: "Dedicated queue for faster processing", annual: true },
  { label: "Annual Savings", desc: "Get 2 months free when billed yearly", annual: true },
];

const COMPARISON = [
  { feature: "Daily video generations", free: "1 video", pro: "Unlimited" },
  { label: "AI Narratives", free: true, pro: true },
  { label: "Profile Enrichment", free: "Basic", pro: "Premium" },
  { label: "HeyGen Clones", free: "Standard", pro: "Pro (High-def)" },
  { label: "Canvas Studio", free: "View only", pro: "Full Edit" },
  { label: "Custom Branding", free: false, pro: true },
];

const FAQS = [
  { q: "Is the first video really free?", a: "Yes. You can generate and preview your first video narrative for free. No credit card required." },
  { q: "Can I cancel anytime?", a: "Absolutely. Cancel through your dashboard in one click. No long-term commitments." },
  { q: "What is 'Profile Intel'?", a: "nuncio analyzes your recipient's public activity to craft a narrative that resonates with their specific professional context, not just generic scraping." },
  { q: "Do you offer enterprise plans?", a: "We do. If you need custom API access or volume discounts for teams, contact us at team@nuncio.ai" },
];

function PricingContent() {
  const [loading, setLoading] = useState<string | null>(null);
  const [annual, setAnnual] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  const currentPriceId = annual ? ANNUAL_PRICE_ID : MONTHLY_PRICE_ID;
  const price = annual ? "$290" : "$29";
  const period = annual ? "/year" : "/month";

  async function handleCheckout() {
    if (!currentPriceId) {
      alert("Stripe not configured.");
      return;
    }
    setLoading(annual ? "annual" : "monthly");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: currentPriceId, planType: annual ? "pro-annual" : "pro-monthly" }),
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
    <main className="flex-1 px-6 max-w-6xl mx-auto w-full pt-28 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-16"
      >
        <span className="text-[10px] uppercase tracking-widest font-medium text-accent mb-4 block">
          Pricing
        </span>
        <h1 className="font-[family-name:var(--font-display)] text-5xl md:text-7xl tracking-tighter leading-[0.85] mb-6">
          Scale your impact,<br />not your costs.
        </h1>
        <p className="text-ink-muted text-base max-w-lg mx-auto">
          One simple plan for power users. Free forever for the curious.
        </p>
      </motion.div>

      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-2xl mx-auto mb-12 p-6 rounded-2xl bg-success-soft border border-success/20 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-success flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 16 16" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3.5 8l3 3 6-6" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-ink mb-1">Welcome to the Pro family!</h3>
            <p className="text-sm text-ink-muted">Your subscription is active. Start generating unlimited narratives now.</p>
          </motion.div>
        )}
        {canceled && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-md mx-auto mb-12 p-4 rounded-xl bg-warm-soft border border-warm/20 text-center"
          >
            <p className="text-sm font-medium text-warm">Checkout was not completed. If you need help, let us know.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid md:grid-cols-2 gap-8 items-start max-w-5xl mx-auto">
        {/* Free Plan (Anchoring) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl border border-cream-dark bg-white/50 p-8 md:p-10"
        >
          <span className="text-[10px] uppercase tracking-widest font-medium text-ink-faint">
            Getting started
          </span>
          <div className="mt-6 flex items-baseline gap-1">
            <span className="font-[family-name:var(--font-display)] text-6xl tracking-tight text-ink-muted">
              $0
            </span>
            <span className="text-sm text-ink-faint">/forever</span>
          </div>
          <p className="text-sm text-ink-muted mt-2 mb-8">
            Experience the magic of nuncio with no strings attached.
          </p>

          <ul className="space-y-4 mb-10">
            {COMPARISON.map((item, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">{item.label || item.feature}</span>
                <span className="font-medium text-ink">
                  {typeof item.free === "boolean" ? (
                    item.free ? "✓" : "—"
                  ) : (
                    item.free
                  )}
                </span>
              </li>
            ))}
          </ul>

          <button
            onClick={() => window.location.assign("/")}
            className="w-full rounded-xl border border-cream-dark py-3.5 text-sm font-medium text-ink hover:bg-cream-dark/30 transition-colors"
          >
            Try for free
          </button>
        </motion.div>

        {/* Pro Plan */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="relative"
        >
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
            <span className="text-[10px] uppercase tracking-widest font-bold text-white bg-accent px-4 py-1.5 rounded-full shadow-lg shadow-accent/20">
              Highly Recommended
            </span>
          </div>

          <div className="rounded-3xl border-2 border-accent bg-white p-8 md:p-10 shadow-2xl shadow-accent/5">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2 bg-cream-dark/50 p-1 rounded-full">
                <button
                  onClick={() => setAnnual(false)}
                  className={`px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-bold transition-all ${!annual ? "bg-white text-ink shadow-sm" : "text-ink-faint"}`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setAnnual(true)}
                  className={`px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-bold transition-all ${annual ? "bg-accent text-white shadow-sm" : "text-ink-faint"}`}
                >
                  Yearly
                </button>
              </div>
              {annual && (
                <span className="text-[10px] font-bold text-success bg-success-soft px-2 py-1 rounded-md animate-pulse">
                  -17% OFF
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-1">
              <span className="font-[family-name:var(--font-display)] text-7xl tracking-tight text-accent">
                {price}
              </span>
              <span className="text-sm text-ink-muted font-medium">{period}</span>
            </div>

            <p className="text-sm text-ink-muted mt-3 mb-8">
              Unlock the full power of AI-driven video narratives and personalization.
            </p>

            <button
              onClick={handleCheckout}
              disabled={loading !== null}
              className="btn-press w-full rounded-xl bg-ink text-cream py-4 text-sm font-bold disabled:opacity-40 hover:bg-ink-light transition-all shadow-xl shadow-ink/10 mb-10"
            >
              {loading === "annual" || loading === "monthly" ? "Preparing secure checkout..." : `Get Pro ${annual ? "Annual" : "Monthly"}`}
            </button>

            <ul className="space-y-4">
              {FEATURES.filter((f) => annual || !f.annual).map((f) => (
                <motion.li
                  key={f.label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-4"
                >
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-accent-soft flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 12 12" className="w-3 h-3 text-accent" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M2.5 6l2.5 2.5 4.5-5" />
                    </svg>
                  </span>
                  <div>
                    <span className="text-sm font-semibold text-ink leading-none">{f.label}</span>
                    <span className="text-[11px] text-ink-muted block mt-0.5">{f.desc}</span>
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>

      {/* Trust badges */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex flex-wrap items-center justify-center gap-10 mt-20 text-[10px] uppercase tracking-widest font-semibold text-ink-faint"
      >
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 14 14" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 1l1.5 3.1L12 4.6l-2 2.4.5 3.5L7 8.5l-3.5 2L4 7l-2-2.4 3.5-.5L7 1z" />
          </svg>
          Stripe Verified
        </span>
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 14 14" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1.5" y="5.5" width="11" height="7" rx="1" />
            <path d="M4.5 5.5V4a2.5 2.5 0 015 0v1.5" />
          </svg>
          256-bit Encryption
        </span>
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 14 14" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 7.5L5 11l7-8" />
          </svg>
          Cancel with 1-click
        </span>
      </motion.div>

      {/* Test mode notice */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center text-[10px] font-medium text-warm bg-warm-soft/50 border border-warm/10 rounded-full px-4 py-1.5 w-fit mx-auto mt-8"
      >
        Public Beta — Use test card 4242 4242 4242 4242
      </motion.p>

      {/* FAQ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="max-w-lg mx-auto mt-20"
      >
        <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-center mb-8">
          Frequently asked questions
        </h2>
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <div key={i} className="rounded-xl border border-cream-dark bg-white overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-ink hover:bg-cream/50 transition-colors text-left"
              >
                {faq.q}
                <motion.svg
                  viewBox="0 0 12 12"
                  className="w-3 h-3 text-ink-faint shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  animate={{ rotate: openFaq === i ? 180 : 0 }}
                >
                  <path d="M2 4.5l4 4 4-4" />
                </motion.svg>
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-4 text-sm text-ink-muted leading-relaxed">{faq.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </motion.div>
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
