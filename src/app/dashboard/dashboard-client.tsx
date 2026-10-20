"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Header } from "@/components/header";
import { CreditCard } from "./components/credit-card";
import { RecentVideos } from "./components/recent-videos";
import { UsageSummary } from "./components/usage-summary";
import { ScoreboardCard } from "./components/scoreboard-card";
import { CallRequestsCard } from "./components/call-requests-card";
import { ApprovalsCard } from "./components/approvals-card";
import { ScheduledConversations } from "./components/scheduled-conversations";
import { SetupPanel } from "./components/setup-panel";
import Link from "next/link";
import { LottieIcon } from "@/components/lottie-icon";
import posthog from "posthog-js";
import { clearViralRef, readViralRef } from "@/lib/viral-ref-client";
import { APP_ROUTES, PRODUCT_ONELINER } from "@/lib/navigation";
import type { InboxPayload } from "@/lib/inbox";
import type { BatchSummary } from "./components/recent-videos";

const POLL_MS = 15_000;

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
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inbox, setInbox] = useState<InboxPayload | null>(null);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [batchError, setBatchError] = useState(false);
  const inFlightRef = useRef<AbortController | null>(null);

  /**
   * One request feeds the whole dashboard: the first-touch list with its
   * relationship state, the scoreboard and the bookings card. It refreshes on
   * the same 15s cadence the bookings card used to poll on its own.
   */
  const loadInbox = useCallback(async () => {
    if (inFlightRef.current) return;
    const controller = new AbortController();
    inFlightRef.current = controller;
    try {
      const res = await fetch("/api/inbox", { signal: controller.signal, cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as InboxPayload;
      setInbox(data);
      setInboxError(null);
    } catch {
      setInboxError("Could not load your inbox.");
    } finally {
      if (inFlightRef.current === controller) inFlightRef.current = null;
    }
  }, []);

  useEffect(() => {
    fetch("/api/account/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.authenticated) {
          router.replace(`/login?next=${encodeURIComponent(APP_ROUTES.inbox)}`);
          return;
        }
        setSession(data);
        setLoading(false);
        attributeViralRef(data.email);
      })
      .catch(() => {
        router.replace(`/login?next=${encodeURIComponent(APP_ROUTES.inbox)}`);
      });
  }, [router]);

  useEffect(() => {
    // Deferred so the first paint is not gated on the inbox request.
    queueMicrotask(() => void loadInbox());
    fetch("/api/batch")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setBatches(Array.isArray(data) ? data : []))
      .catch(() => setBatchError(true));
    const timer = setInterval(loadInbox, POLL_MS);
    const onFocus = () => {
      if (document.visibilityState !== "hidden") void loadInbox();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      inFlightRef.current?.abort();
      inFlightRef.current = null;
    };
  }, [loadInbox]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LottieIcon name="spinner" className="w-10 h-10" />
      </div>
    );
  }

  return (
    <>
      <Header stage="input" />
      <main className="flex-1 px-6 pt-28 pb-16">
        <div className="max-w-[1200px] mx-auto space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-wrap items-end justify-between gap-4"
          >
            <div className="max-w-[640px]">
              <h1 className="font-display text-3xl text-ink">Inbox</h1>
              <p className="text-body-sm text-ink-muted mt-2 leading-relaxed">
                {PRODUCT_ONELINER} Everything a prospect sends back lands here.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <Link
                href={APP_ROUTES.representative}
                className="btn-press rounded-xl border border-ink/15 text-ink-muted px-4 py-2.5 text-body-xs font-medium hover:text-ink transition-colors min-h-[44px] inline-flex items-center"
              >
                Your representative
              </Link>
              <Link
                href={APP_ROUTES.create}
                className="btn-press rounded-xl bg-accent text-white px-4 py-2.5 text-body-xs font-medium hover:bg-accent/90 transition-colors min-h-[44px] inline-flex items-center gap-1.5"
              >
                Create a first touch
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </Link>
            </div>
          </motion.div>

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
                <ApprovalsCard />
                <CallRequestsCard />
              </section>
              <section aria-label="Bookings and live sessions">
                <ScheduledConversations
                  bookings={inbox?.bookings ?? []}
                  loaded={inbox !== null}
                  error={inboxError !== null}
                  onRetry={() => void loadInbox()}
                />
              </section>
              <section aria-label="Sent first touches">
                <RecentVideos entries={inbox?.entries ?? []} batches={batches} batchError={batchError} />
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
                  <UsageSummary videoCount={inbox?.videoCount ?? 0} batches={batches} />
                  <ScoreboardCard
                    sessions={inbox?.sessions ?? []}
                    bookings={inbox?.bookings ?? []}
                    loading={inbox === null && inboxError === null}
                    error={inboxError}
                  />
                </div>
              </details>
            </motion.aside>
          </div>
        </div>
      </main>
    </>
  );
}
