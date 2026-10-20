"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Header } from "@/components/header";
import { LottieIcon } from "@/components/lottie-icon";
import { SetupPanel } from "@/app/dashboard/components/setup-panel";
import { APP_ROUTES, PRODUCT_ONELINER } from "@/lib/navigation";
import Link from "next/link";

interface SessionData {
  authenticated: boolean;
  email?: string;
}

/**
 * Setup is its own route, not a query-string variant of the dashboard.
 * Two destinations that differ only by `?view=` are indistinguishable in a
 * URL, in a browser history entry, and in a shared link.
 */
export default function SetupClient() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/account/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.authenticated) {
          router.replace(`/login?next=${encodeURIComponent(APP_ROUTES.representative)}`);
          return;
        }
        setSession(data);
        setLoading(false);
      })
      .catch(() => {
        router.replace(`/login?next=${encodeURIComponent(APP_ROUTES.representative)}`);
      });
  }, [router]);

  // "Start with one message" is only worth offering to someone who has not
  // configured anything yet. For everyone else, configuring first is the
  // right advice — and nagging a configured user is noise.
  useEffect(() => {
    fetch("/api/account/brief", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { playbookWants?: string; playbookOffer?: string; senderName?: string }) => {
        const hasPlaybook = Boolean(data.playbookWants?.trim() || data.playbookOffer?.trim());
        setConfigured(hasPlaybook || Boolean(data.senderName?.trim()));
      })
      .catch(() => setConfigured(null));
  }, []);

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
        <div className="max-w-[860px] mx-auto space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-[640px]"
          >
            <h1 className="font-display text-3xl text-ink">Your representative</h1>
            <p className="text-body-sm text-ink-muted mt-2 leading-relaxed">
              {PRODUCT_ONELINER} Everything on this page is what it reads from
              when a prospect asks a question.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href={APP_ROUTES.create}
                className="btn-press rounded-xl bg-ink text-cream px-4 py-2.5 text-body-xs font-medium transition-colors min-h-[44px] inline-flex items-center gap-1.5"
              >
                Create a first touch
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </Link>
              <Link
                href={APP_ROUTES.inbox}
                className="btn-press rounded-xl border border-ink/15 text-ink-muted px-4 py-2.5 text-body-xs font-medium hover:text-ink transition-colors min-h-[44px] inline-flex items-center"
              >
                Back to inbox
              </Link>
            </div>
          </motion.div>

          {configured === false && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.03 }}
              className="rounded-2xl border border-accent/20 bg-accent-soft/40 p-5 space-y-2"
            >
              <h2 className="font-display text-lg text-ink">Start with one message</h2>
              <p className="text-body-xs text-ink-muted leading-relaxed">
                You don&apos;t have to finish this page before you send anything. Send one
                first touch now — your representative answers from general guidance until
                you set its playbook. You can come back here whenever you like.
              </p>
              <Link
                href={APP_ROUTES.create}
                className="inline-block text-label-base uppercase tracking-widest font-medium text-accent hover:text-accent/80 transition-colors"
              >
                Create a first touch →
              </Link>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            <SetupPanel />
          </motion.div>
        </div>
      </main>
    </>
  );
}
