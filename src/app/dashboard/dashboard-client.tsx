"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Header } from "@/components/header";
import { CreditCard } from "./components/credit-card";
import { RecentVideos } from "./components/recent-videos";
import { QuickActions } from "./components/quick-actions";
import { UsageSummary } from "./components/usage-summary";
import { OnboardingModal } from "@/components/onboarding-modal";
import Link from "next/link";

interface SessionData {
  authenticated: boolean;
  email?: string;
  plan?: string;
  balance?: number;
  workspaceId?: string;
}

export default function DashboardClient() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/account/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.authenticated) {
          router.replace("/login");
          return;
        }
        setSession(data);
        setLoading(false);
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [router]);

  if (loading || !session) return null;

  return (
    <>
      <Header stage="input" />
      <OnboardingModal />
      <main className="flex-1 px-6 pt-28 pb-16">
        <div className="max-w-4xl mx-auto space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="font-[family-name:var(--font-display)] text-3xl text-ink">
              Welcome back
            </h1>
            <p className="text-sm text-ink-muted mt-1">{session.email}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            <Link
              href="/studio"
              className="btn-press flex items-center justify-between rounded-2xl bg-ink text-cream px-6 py-5 hover:bg-ink-light transition-colors group"
            >
              <div>
                <span className="text-sm font-medium">Create a new video</span>
                <p className="text-xs text-cream/60 mt-0.5">Drop a profile URL, get a personalised video in minutes</p>
              </div>
              <svg viewBox="0 0 16 16" className="w-5 h-5 text-cream/50 group-hover:text-cream group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <CreditCard />
            <UsageSummary />
            <QuickActions />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <RecentVideos />
          </motion.div>
        </div>
      </main>
    </>
  );
}
