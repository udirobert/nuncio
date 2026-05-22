"use client";

import { Suspense, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";

const MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID || "";
const ANNUAL_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID || "";
const CREDIT_PACKS = [
  {
    id: "credits-100",
    label: "100 credits",
    price: "$15",
    priceId: process.env.NEXT_PUBLIC_STRIPE_CREDITS_100_PRICE_ID || "",
    note: "Top up for a short campaign.",
  },
  {
    id: "credits-500",
    label: "500 credits",
    price: "$99",
    priceId: process.env.NEXT_PUBLIC_STRIPE_CREDITS_500_PRICE_ID || "",
    note: "Best for founder-led prospecting.",
  },
] as const;

const PLAN_TIERS = [
  {
    id: "trial",
    name: "Trial",
    eyebrow: "Anonymous judges",
    price: "$0",
    period: "first canvas",
    hookModel: "10 trial credits",
    quality: "Draft workflow",
    allowance: "Enough for research + one review",
    speed: "Render requires account",
    watermark: "Public share",
    cta: "Start anonymous",
    note: "No email. Drop a profile URL and watch the agent build.",
    featured: false,
  },
  {
    id: "free",
    name: "Free",
    eyebrow: "Email captured",
    price: "$0",
    period: "monthly",
    hookModel: "10 starter credits",
    quality: "Account ledger",
    allowance: "Spend across research, scripts, canvas, render",
    speed: "5 credits per render",
    watermark: "Public share",
    cta: "Try free",
    note: "Unlocks extra rerolls and a shareable campaign link.",
    featured: false,
  },
  {
    id: "pro",
    name: "Pro",
    eyebrow: "Recommended",
    price: "$39",
    annualPrice: "$390",
    period: "month",
    annualPeriod: "year",
    hookModel: "200 credits / month",
    quality: "Cinematic renders",
    allowance: "Credits spend across every Nuncio stage",
    speed: "Unused credits tracked in ledger",
    watermark: "No watermark",
    cta: "Get Pro",
    note: "Best for reps and founders sending real social-ready outreach.",
    featured: true,
  },
  {
    id: "studio",
    name: "Studio",
    eyebrow: "Agency / brand",
    price: "$79+",
    period: "month",
    hookModel: "1,000+ credits / month",
    quality: "Team workspace",
    allowance: "Shared credit pool and usage history",
    speed: "Priority render capacity",
    watermark: "No watermark",
    cta: "Talk to us",
    note: "For teams that want shared credits, brand review, and volume.",
    featured: false,
  },
] as const;

const FAQS = [
  { q: "What are Nuncio credits?", a: "Credits are the single balance used for research, script generation, canvas creation, rendering, translation, captions, and delivery." },
  { q: "Can I cancel anytime?", a: "Absolutely. Cancel through your dashboard in one click. No long-term commitments." },
  { q: "How many credits does a video use?", a: "A full video costs 11 credits: 1 for research, 1 for script, 1 for canvas, 1 for soundscape, and 8 for rendering." },
  { q: "Do you offer agency plans?", a: "We do. Studio is for teams that need higher monthly volume, shared credits, brand review, and usage reporting." },
];

function PricingContent() {
  const [loading, setLoading] = useState<string | null>(null);
  const [annual, setAnnual] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  const currentPriceId = annual ? ANNUAL_PRICE_ID : MONTHLY_PRICE_ID;

  async function handleCheckout(priceId = currentPriceId, planType = annual ? "pro-annual" : "pro-monthly", mode: "subscription" | "payment" = "subscription") {
    if (!priceId) {
      alert("Stripe not configured.");
      return;
    }
    setLoading(planType);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, planType, mode }),
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
          Buy one Nuncio credit balance and spend it across research, scripts, creative canvases, renders, translations, captions, and delivery.
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
            <p className="text-sm text-ink-muted">Your subscription is active. Monthly Nuncio credits are now available in your workspace.</p>
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

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5 items-stretch max-w-6xl mx-auto">
        {PLAN_TIERS.map((tier, index) => {
          const isPro = tier.id === "pro";
          const displayedPrice = isPro && annual && "annualPrice" in tier ? tier.annualPrice : tier.price;
          const displayedPeriod = isPro && annual && "annualPeriod" in tier ? tier.annualPeriod : tier.period;
          const isLoading = loading === "annual" || loading === "monthly";

          return (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * index }}
              className={`relative rounded-2xl border bg-white p-5 flex flex-col min-h-[520px] ${
                tier.featured
                  ? "border-2 border-accent shadow-2xl shadow-accent/5"
                  : "border-cream-dark"
              }`}
            >
              {tier.featured && (
                <div className="absolute -top-3 left-5">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-white bg-accent px-3 py-1.5 rounded-full shadow-lg shadow-accent/20">
                    Recommended
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-medium text-ink-faint">
                    {tier.eyebrow}
                  </span>
                  <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight mt-2">
                    {tier.name}
                  </h2>
                </div>
                {isPro && (
                  <span className="text-[10px] font-bold text-success bg-success-soft px-2 py-1 rounded-md">
                    {annual ? "-17%" : "Monthly"}
                  </span>
                )}
              </div>

              {isPro && (
                <div className="flex items-center gap-2 bg-cream-dark/50 p-1 rounded-full mt-5">
                  <button
                    onClick={() => setAnnual(false)}
                    className={`flex-1 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-bold transition-all ${!annual ? "bg-white text-ink shadow-sm" : "text-ink-faint"}`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setAnnual(true)}
                    className={`flex-1 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-bold transition-all ${annual ? "bg-accent text-white shadow-sm" : "text-ink-faint"}`}
                  >
                    Yearly
                  </button>
                </div>
              )}

              <div className="mt-6 flex items-baseline gap-1">
                <span className={`font-[family-name:var(--font-display)] text-5xl tracking-tight ${tier.featured ? "text-accent" : "text-ink-muted"}`}>
                  {displayedPrice}
                </span>
                <span className="text-sm text-ink-faint">/{displayedPeriod}</span>
              </div>

              <p className="text-sm text-ink-muted mt-3 min-h-[58px]">
                {tier.note}
              </p>

              <div className="rounded-xl border border-cream-dark bg-cream/40 p-3 mt-5 space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink-muted">Credits</span>
                  <span className="font-semibold text-ink text-right">{tier.hookModel}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink-muted">Quality</span>
                  <span className="font-medium text-ink text-right">{tier.quality}</span>
                </div>
              </div>

              <ul className="space-y-3 mt-5 mb-6 text-sm">
                {[tier.allowance, tier.speed, tier.watermark].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 w-4 h-4 rounded-full bg-accent-soft flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-accent" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M2.5 6l2.5 2.5 4.5-5" />
                      </svg>
                    </span>
                    <span className="text-ink-muted">{item}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => {
                  if (isPro) {
                    handleCheckout();
                    return;
                  }
                  if (tier.id === "studio") {
                    window.location.assign("mailto:team@nuncio.ai?subject=Studio%20plan");
                    return;
                  }
                  window.location.assign("/studio");
                }}
                disabled={isPro && loading !== null}
                className={`btn-press w-full rounded-xl py-3.5 text-sm font-bold transition-all mt-auto disabled:opacity-40 ${
                  tier.featured
                    ? "bg-ink text-cream hover:bg-ink-light shadow-xl shadow-ink/10"
                    : "border border-cream-dark text-ink hover:bg-cream-dark/30"
                }`}
              >
                {isPro && isLoading ? "Preparing secure checkout..." : `${tier.cta}${isPro ? annual ? " Annual" : " Monthly" : ""}`}
              </button>
            </motion.div>
          );
        })}
      </div>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mt-10 rounded-2xl border border-cream-dark bg-white p-5"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-widest font-medium text-accent">
              Credit packs
            </span>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight">
              Top up without changing plans.
            </h2>
          </div>
          <p className="max-w-md text-sm text-ink-muted">
            One-time packs are useful while Stripe is in test mode and for users who need a few extra renders.
          </p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {CREDIT_PACKS.map((pack) => (
            <button
              key={pack.id}
              onClick={() => handleCheckout(pack.priceId, pack.id, "payment")}
              disabled={!pack.priceId || loading === pack.id}
              className="btn-press rounded-xl border border-cream-dark p-4 text-left transition-all hover:border-accent/40 hover:bg-accent-soft/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-ink">{pack.label}</span>
                <span className="font-[family-name:var(--font-display)] text-2xl text-accent">{pack.price}</span>
              </div>
              <p className="mt-1 text-xs text-ink-muted">{pack.note}</p>
              <p className="mt-3 text-[10px] uppercase tracking-widest text-ink-faint">
                {pack.priceId ? loading === pack.id ? "Opening checkout..." : "Buy pack" : "Price ID missing"}
              </p>
            </button>
          ))}
        </div>
      </motion.section>

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
