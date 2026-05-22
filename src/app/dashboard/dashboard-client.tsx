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
