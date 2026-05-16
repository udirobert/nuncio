"use client";

import { motion } from "motion/react";
import { useState } from "react";
import type { PipelineState } from "@/lib/pipeline";

interface HeaderProps {
  stage: PipelineState["stage"];
  isDemo?: boolean;
}

const STAGE_LABELS: Record<PipelineState["stage"], string> = {
  input: "",
  progress: "Working",
  coach: "Angles",
  review: "Review",
  done: "Complete",
  error: "",
};

async function handleUpgrade() {
  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID;
  if (!priceId) {
    alert("Stripe not configured. Add STRIPE_PRO_MONTHLY_PRICE_ID to env.");
    return;
  }

  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId, planType: "pro" }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
  } catch (e) {
    console.error("Checkout failed:", e);
  }
}

export function Header({ stage, isDemo }: HeaderProps) {
  const showStage = stage !== "input" && stage !== "error";
  const [loading, setLoading] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between pointer-events-none">
      <motion.a
        href="/"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="pointer-events-auto font-[family-name:var(--font-display)] text-xl font-medium tracking-tight text-ink hover:text-ink-light transition-colors"
      >
        nuncio
      </motion.a>

      <div className="pointer-events-auto flex items-center gap-3">
        {stage === "input" && (
          <>
            <motion.button
              onClick={async () => { setLoading(true); await handleUpgrade(); }}
              disabled={loading}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="text-xs text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
            >
              {loading ? "Loading..." : "Upgrade"}
            </motion.button>
            <motion.a
              href="/playbook"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="text-xs text-ink-muted hover:text-ink transition-colors"
            >
              Playbook
            </motion.a>
          </>
        )}
        {isDemo && (
          <span className="text-[10px] uppercase tracking-widest font-medium text-warm bg-warm-soft px-2 py-0.5 rounded-full">
            Demo
          </span>
        )}
        {showStage && (
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            className="flex items-center gap-2"
          >
            {stage === "progress" && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
            )}
            {stage === "done" && (
              <span className="flex h-2 w-2 rounded-full bg-success" />
            )}
            <span className="text-xs uppercase tracking-widest text-ink-faint font-medium">
              {STAGE_LABELS[stage]}
            </span>
          </motion.div>
        )}
      </div>
    </header>
  );
}
