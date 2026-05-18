"use client";

import { Suspense, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";

const MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID || "";
const ANNUAL_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID || "";

const FEATURES = [
  { label: "AI-powered video narratives", desc: "From any social profile URL" },
  { label: "LinkedIn / X profile enrichment", desc: "Structured context, not scraped soup" },
  { label: "Custom script generation", desc: "References real, recent work" },
  { label: "HeyGen avatar rendering", desc: "Your cloned voice and avatar" },
  { label: "Melius canvas studio", desc: "Interactive creative canvas" },
  { label: "Share pages with captions", desc: "Speechmatics-powered captions" },
  { label: "Priority generation queue", desc: "Skip the line", annual: true },
  { label: "Annual savings", desc: "2 months free", annual: true },
];

const FAQS = [
  { q: "Can I cancel anytime?", a: "Yes. You can cancel your subscription at any time. No long-term contracts." },
  { q: "What happens when I cancel?", a: "You keep access until the end of your billing period. After that, your account reverts to the free tier." },
  { q: "Is there a free trial?", a: "You can try nuncio right now — generate a video with any public profile URL. No credit card needed." },
  { q: "What payment methods do you accept?", a: "We use Stripe for payment processing. All major credit and debit cards are accepted." },
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
        className="text-center mb-12"
      >
        <span className="text-[10px] uppercase tracking-widest font-medium text-accent mb-4 block">
          Pricing
        </span>
        <h1 className="font-[family-name:var(--font-display)] text-5xl md:text-6xl tracking-tight leading-[0.9] mb-4">
          One plan, no&nbsp;surprises.
        </h1>
        <p className="text-ink-muted text-sm max-w-md mx-auto">
          Cancel anytime. Your first video is free — no credit card required.
        </p>
      </motion.div>

      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-md mx-auto mb-8 p-4 rounded-xl bg-success-soft border border-success/20 text-center"
          >
            <p className="text-sm font-medium text-success">Subscription successful! Welcome to nuncio Pro.</p>
          </motion.div>
        )}
        {canceled && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-md mx-auto mb-8 p-4 rounded-xl bg-warm-soft border border-warm/20 text-center"
          >
            <p className="text-sm font-medium text-warm">Checkout canceled. No charges were made.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex items-center justify-center gap-3 mb-10"
      >
        <span className={`text-sm ${annual ? "text-ink-muted" : "text-ink font-medium"}`}>Monthly</span>
        <button
          onClick={() => setAnnual(!annual)}
          className={`relative w-12 h-6 rounded-full transition-colors ${annual ? "bg-ink" : "bg-cream-dark"}`}
        >
          <motion.span
            layout
            className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
            animate={{ x: annual ? 26 : 0 }}
          />
        </button>
        <span className={`text-sm ${annual ? "text-ink font-medium" : "text-ink-muted"}`}>
          Annual
          <span className="text-accent ml-1 text-[11px]">Save 17%</span>
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-lg mx-auto"
      >
        <div className="rounded-3xl border-2 border-accent bg-white p-8 md:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-accent" />
          <span className="text-[10px] uppercase tracking-widest font-medium text-accent bg-accent-soft px-2 py-0.5 rounded-full">
            Most popular
          </span>

          <div className="mt-6 flex items-baseline gap-1">
            <span className="font-[family-name:var(--font-display)] text-6xl tracking-tight">
              {price}
            </span>
            <span className="text-sm text-ink-muted">{period}</span>
          </div>

          <p className="text-sm text-ink-muted mt-2 mb-8">
            Everything you need to send personalised video narratives at scale.
          </p>

          <button
            onClick={handleCheckout}
            disabled={loading !== null}
            className="btn-press w-full rounded-xl bg-ink text-cream py-3.5 text-sm font-medium disabled:opacity-40 hover:bg-ink-light transition-colors mb-8"
          >
            {loading === "annual" || loading === "monthly" ? "Redirecting to Stripe..." : "Subscribe now"}
          </button>

          <ul className="space-y-3">
            {FEATURES.filter((f) => annual || !f.annual).map((f) => (
              <motion.li
                key={f.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-3"
              >
                <span className="mt-0.5 w-5 h-5 rounded-full bg-success-soft flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 12 12" className="w-3 h-3 text-success" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2.5 6l2.5 2.5 4.5-5" />
                  </svg>
                </span>
                <div>
                  <span className="text-sm font-medium text-ink">{f.label}</span>
                  <span className="text-xs text-ink-faint block">{f.desc}</span>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      </motion.div>

      {/* Trust badges */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="flex flex-wrap items-center justify-center gap-6 mt-10 text-[11px] text-ink-faint"
      >
        <span className="flex items-center gap-1.5">
          <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 1l1.5 3.1L12 4.6l-2 2.4.5 3.5L7 8.5l-3.5 2L4 7l-2-2.4 3.5-.5L7 1z" />
          </svg>
          Powered by Stripe
        </span>
        <span className="flex items-center gap-1.5">
          <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1.5" y="5.5" width="11" height="7" rx="1" />
            <path d="M4.5 5.5V4a2.5 2.5 0 015 0v1.5" />
          </svg>
          SSL encrypted
        </span>
        <span className="flex items-center gap-1.5">
          <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 7.5L5 11l7-8" />
          </svg>
          Cancel anytime
        </span>
      </motion.div>

      {/* Test mode notice */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-center text-[11px] text-ink-faint mt-4"
      >
        Test mode — no real charges. Use card 4242 4242 4242 4242.
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
