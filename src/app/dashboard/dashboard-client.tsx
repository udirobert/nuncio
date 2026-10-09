"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Header } from "@/components/header";
import { CreditCard } from "./components/credit-card";
import { RecentVideos } from "./components/recent-videos";
import { QuickActions } from "./components/quick-actions";
import { UsageSummary } from "./components/usage-summary";
import { ScoreboardCard } from "./components/scoreboard-card";
import { CallRequestsCard } from "./components/call-requests-card";
import { ScheduledConversations } from "./components/scheduled-conversations";
import { SetupPanel } from "./components/setup-panel";
import { OnboardingModal } from "@/components/onboarding-modal";
import Link from "next/link";
import { LottieIcon } from "@/components/lottie-icon";
import posthog from "posthog-js";
import { clearViralRef, readViralRef } from "@/lib/viral-ref-client";

interface SessionData {
  authenticated: boolean;
  email?: string;
  plan?: string;
  balance?: number;
  workspaceId?: string;
}

/** Viral-loop attribution: merge anon PostHog identity and hand the stored ?ref= to the server once. */
function attributeViralRef(email?: string) {
  if (!email) return;
  posthog.identify(email);
  const ref = readViralRef();
  if (!ref) return;
  fetch("/api/account/attribution", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ref }),
  })
    .then((r) => {
      // Any handled response is final (attributed, already attributed, or
      // refused) — retrying can't change it. Keep the ref only for a session
      // glitch, so a stale cookie doesn't silently drop attribution forever.
      if (r.status !== 401) clearViralRef();
    })
    .catch(() => {});
}

export default function DashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "setup" ? "setup" : "conversations";
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/account/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.authenticated) {
          router.replace(`/login?next=${encodeURIComponent(view === "setup" ? "/dashboard?view=setup" : "/dashboard")}`);
          return;
        }
        setSession(data);
        setLoading(false);
        attributeViralRef(data.email);
      })
      .catch(() => {
        router.replace(`/login?next=${encodeURIComponent(view === "setup" ? "/dashboard?view=setup" : "/dashboard")}`);
      });
  }, [router, view]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LottieIcon name="spinner" className="w-10 h-10" />
      </div>
    );
  }

  return (
    <>
      <Header stage="input" activeWorkspaceView={view} />
      <OnboardingModal />
      <main className="flex-1 px-6 pt-28 pb-16">
        <div className="max-w-[1200px] mx-auto space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-wrap items-end justify-between gap-4"
          >
            <div>
              <h1 className="font-display text-3xl text-ink">
                {view === "setup" ? "Setup" : "Conversations"}
              </h1>
              <p className="text-sm text-ink-muted mt-1">
                {view === "setup"
                  ? "Who your representative speaks for, and the boundaries it answers within."
                  : "Requests, first touches, and live sessions for your workspace."}
              </p>
            </div>
            <nav aria-label="Workspace" className="flex flex-wrap items-center gap-2 min-w-0">
              <Link
                href="/dashboard"
                aria-current={view === "conversations" ? "page" : undefined}
                className={`btn-press rounded-xl px-4 py-2.5 text-body-xs font-medium transition-colors min-h-[44px] inline-flex items-center ${
                  view === "conversations" ? "bg-ink text-cream" : "border border-ink/15 text-ink-muted hover:text-ink"
                }`}
              >
                Conversations
              </Link>
              <Link
                href="/dashboard?view=setup"
                aria-current={view === "setup" ? "page" : undefined}
                className={`btn-press rounded-xl px-4 py-2.5 text-body-xs font-medium transition-colors min-h-[44px] inline-flex items-center ${
                  view === "setup" ? "bg-ink text-cream" : "border border-ink/15 text-ink-muted hover:text-ink"
                }`}
              >
                Setup
              </Link>
              <Link
                href="/studio"
                className="btn-press rounded-xl bg-accent text-white px-4 py-2.5 text-body-xs font-medium hover:bg-accent/90 transition-colors min-h-[44px] inline-flex items-center gap-1.5"
              >
                Create a first touch
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </Link>
            </nav>
          </motion.div>

          {view === "setup" ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
            >
              <SetupPanel />
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="lg:col-span-8 space-y-6"
              >
                <section aria-label="Needs your attention">
                  <h2 className="text-label-sm uppercase tracking-widest text-ink-faint font-medium mb-3">
                    Needs your attention
                  </h2>
                  <CallRequestsCard />
                </section>
                <section aria-label="Scheduled conversations">
                  <ScheduledConversations />
                </section>
                <section aria-label="Recent first touches">
                  <RecentVideos />
                </section>
              </motion.div>

              <motion.aside
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="lg:col-span-4 space-y-4"
              >
                <div className="rounded-2xl border border-cream-dark bg-white/70 p-5 space-y-3">
                  <h2 className="text-label-sm uppercase tracking-widest text-ink-faint font-medium">
                    Your representative
                  </h2>
                  <SetupPanel variant="summary" />
                  <div className="border-t border-cream-dark pt-3">
                    <p className="text-body-xs text-ink-faint leading-relaxed">
                      <span className="font-medium text-ink-muted">How a handoff works:</span> a request arrives here →
                      you accept → both sides join the room → the AI steps aside. Availability is a switch you control;
                      it expires on its own. Keep this dashboard open to see requests.
                    </p>
                  </div>
                </div>

                <details className="rounded-2xl border border-cream-dark bg-white/70 p-5 space-y-4 group">
                  <summary className="text-label-sm uppercase tracking-widest text-ink-faint font-medium cursor-pointer list-none">
                    Usage &amp; account
                  </summary>
                  <div className="grid grid-cols-1 gap-4 pt-3">
                    <CreditCard />
                    <UsageSummary />
                    <QuickActions />
                    <ScoreboardCard />
                  </div>
                </details>
              </motion.aside>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
