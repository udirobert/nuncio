"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { createClient, AnamEvent, type AnamClient } from "@anam-ai/js-sdk";
import type { ShareRecord } from "@/lib/artifacts";

export default function LiveAvatarLandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [share, setShare] = useState<ShareRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState<string>("Click below to start the live conversation");
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const clientRef = useRef<AnamClient | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    async function load() {
      try {
        const { id } = await params;
        const res = await fetch(`/api/share/${encodeURIComponent(id)}`);
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = (await res.json()) as ShareRecord;
        setShare(data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params]);

  function endSession() {
    if (clientRef.current) {
      try {
        clientRef.current.stopStreaming?.();
        (clientRef.current as { disconnect?: () => void }).disconnect?.();
      } catch {
        // best-effort cleanup
      } finally {
        clientRef.current = null;
        startedRef.current = false;
        setLive(false);
        setStatus("Click below to start the live conversation");
      }
    }
  }

  useEffect(() => {
    function handleBeforeUnload() {
      endSession();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      endSession();
    };
  }, []);

  async function startSession() {
    if (startedRef.current) return;
    const id = (await params).id;
    setStarting(true);
    setError(null);

    try {
      const res = await fetch("/api/live/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId: id }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Could not start live session");
      }

      const data = (await res.json()) as { sessionToken: string };
      const client = createClient(data.sessionToken);
      clientRef.current = client;

      client.addListener(AnamEvent.CONNECTION_ESTABLISHED, () => {
        setStatus("Connected — say hello!");
        setLive(true);
      });

      client.addListener(AnamEvent.CONNECTION_CLOSED, () => {
        setStatus("Session ended");
        setLive(false);
      });

      await client.streamToVideoElement("anam-video");
      startedRef.current = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start live session";
      setError(message);
      setStatus("Click below to try again");
      startedRef.current = false;
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-sm text-ink-faint"
        >
          Loading...
        </motion.div>
      </div>
    );
  }

  if (notFound || !share) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-4">
          <Link href="/" className="font-[family-name:var(--font-display)] text-lg tracking-tight text-ink">
            nuncio
          </Link>
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight">Live link expired</h1>
          <p className="text-sm text-ink-muted leading-relaxed">
            This live conversation link is no longer available.
          </p>
          <Link
            href="/"
            className="btn-press inline-flex rounded-xl bg-ink text-cream px-5 py-3 text-sm font-medium"
          >
            Make your own →
          </Link>
        </div>
      </div>
    );
  }

  const sender = share.senderName || "your contact";
  const recipient = share.recipientName || "there";

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-lg tracking-tight text-ink hover:text-ink-light transition-colors"
        >
          nuncio
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-[720px]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mb-8 text-center"
          >
            <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-tight leading-[0.9] mb-3">
              Hey {recipient}
            </h1>
            <p className="text-ink-muted text-[15px]">
              {sender} is here to talk live
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="absolute -inset-3 rounded-3xl bg-cream-dark/60 -z-10 transform rotate-1" />
            <div className="absolute -inset-1.5 rounded-3xl bg-cream-dark -z-5 transform -rotate-0.5" />

            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-ink shadow-2xl shadow-ink/20 ring-1 ring-ink/5 flex items-center justify-center">
              {live ? (
                <video
                  id="anam-video"
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center text-cream/80 px-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-cream/10 flex items-center justify-center mb-4">
                    <svg viewBox="0 0 24 24" className="w-8 h-8 text-cream" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 1v4M4.2 4.2l2.8 2.8M1 12h4M4.2 19.8l2.8-2.8M12 19v4M16.9 17.6l2.8 2.8M19 12h4M19.8 4.2l-2.8 2.8" />
                      <circle cx="12" cy="12" r="4" />
                    </svg>
                  </div>
                  <p className="text-sm text-cream/70 mb-1">{status}</p>
                  {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 flex items-center gap-3 justify-center"
          >
            {!live ? (
              <button
                onClick={startSession}
                disabled={starting}
                className="btn-press rounded-xl bg-accent text-white px-6 py-3 text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {starting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M8 12.5a4.5 4.5 0 004.5-4.5M8 12.5a4.5 4.5 0 01-4.5-4.5M8 12.5V14m0-13v1.5" />
                    </svg>
                    Start live conversation
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={endSession}
                className="btn-press rounded-xl bg-warm text-white px-6 py-3 text-sm font-medium hover:bg-warm/90 transition-colors flex items-center gap-2"
              >
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="10" height="10" rx="2" />
                </svg>
                End conversation
              </button>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 rounded-2xl border border-cream-dark bg-white/70 p-4"
          >
            <p className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-2">
              How this works
            </p>
            <p className="text-xs text-ink-muted leading-relaxed">
              This is an AI avatar of {sender}. It can answer questions, explain the reason for reaching out, and book a meeting — all within the sender&apos;s playbook. Your microphone is only active while the session is running.
            </p>
          </motion.div>
        </div>
      </main>

      <footer className="px-6 py-6 text-center">
        <p className="text-[11px] text-ink-faint">
          Powered by{" "}
          <Link href="/" className="text-ink-muted hover:text-ink transition-colors font-medium">
            nuncio
          </Link>{" "}
          — your intelligent emissary
        </p>
      </footer>
    </div>
  );
}
