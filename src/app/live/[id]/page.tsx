"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { createClient, AnamEvent, type AnamClient, type Message } from "@anam-ai/js-sdk";
import type { ShareRecord } from "@/lib/artifacts";
import {
  trackBookingClicked,
  trackLiveSessionConnected,
  trackLiveSessionEnded,
  trackLiveSessionFailed,
  trackLiveSessionRequested,
  trackViralCtaClicked,
  trackReconnectCardOpened,
  trackReconnectCatchupClicked,
} from "@/lib/analytics";
import { LIVE_SESSION_MAX_DURATION_MS } from "@/lib/live-link";
import { classifyQuestionTopics } from "@/lib/live-topics";
import { LottieIcon } from "@/components/lottie-icon";

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
  const openedTrackedRef = useRef(false);
  const [errorReason, setErrorReason] = useState<"connection" | "mic" | "provider" | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [live, setLive] = useState(false);
  const clientRef = useRef<AnamClient | null>(null);
  const startedRef = useRef(false);
  const shareIdRef = useRef<string | null>(null);
  const liveSessionIdRef = useRef<string | null>(null);
  const liveSessionSyncTokenRef = useRef<string | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const sessionSyncedRef = useRef(false);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bookingUrlRef = useRef<string | null>(null);
  const metricsRef = useRef({
    userTurns: 0,
    agentTurns: 0,
    topics: new Set<string>(),
    bookingClicked: false,
    lastEvent: "requested",
    firstUserTurnAt: null as string | null,
  });

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
        shareIdRef.current = data.id;
        bookingUrlRef.current = typeof data.bookingUrl === "string" && data.bookingUrl.startsWith("https://")
          ? data.bookingUrl
          : null;
        setShare(data);
        if (!openedTrackedRef.current && data.mode === "reconnect") {
          openedTrackedRef.current = true;
          trackReconnectCardOpened({
            shareId: data.id,
            mode: "reconnect",
            deliveryMode: "livelink",
          });
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params]);

  const recordSessionEnd = useCallback((reason: "manual" | "provider_closed" | "max_duration" | "unload") => {
    const shareId = shareIdRef.current;
    const sessionId = liveSessionIdRef.current;
    const startedAt = sessionStartedAtRef.current;
    if (!shareId || !sessionId || startedAt === null || sessionSyncedRef.current) return;

    const durationMs = Math.max(0, Date.now() - startedAt);
    const metrics = metricsRef.current;
    metrics.lastEvent = `ended:${reason}`;
    const questionTopics = Array.from(metrics.topics);
    trackLiveSessionEnded({
      shareId,
      durationMs,
      reason,
      userTurns: metrics.userTurns,
      agentTurns: metrics.agentTurns,
      questionTopics,
      bookingClicked: metrics.bookingClicked,
    });
    sessionSyncedRef.current = true;

    const payload = JSON.stringify({
      sessionId,
      shareId,
      durationMs,
      reason,
      syncToken: liveSessionSyncTokenRef.current,
      metrics: {
        userTurns: metrics.userTurns,
        agentTurns: metrics.agentTurns,
        questionTopics,
        bookingClicked: metrics.bookingClicked,
        bookingUrlPresent: Boolean(bookingUrlRef.current),
        lastEvent: metrics.lastEvent,
        firstUserTurnAt: metrics.firstUserTurnAt ?? undefined,
      },
    });
    if (reason === "unload" && typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/live/sync", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/live/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
    sessionStartedAtRef.current = null;
  }, []);

  const clearMaxDurationTimer = useCallback(() => {
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
  }, []);

  const clearHeartbeatTimer = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  // Fire-and-forget telemetry heartbeat — only classified topic labels and
  // counters leave the browser, never the raw transcript.
  const sendHeartbeat = useCallback(() => {
    const shareId = shareIdRef.current;
    const sessionId = liveSessionIdRef.current;
    const syncToken = liveSessionSyncTokenRef.current;
    const startedAt = sessionStartedAtRef.current;
    if (!shareId || !sessionId || !syncToken || startedAt === null || sessionSyncedRef.current) return;

    const metrics = metricsRef.current;
    fetch("/api/live/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        shareId,
        syncToken,
        durationMs: Math.max(0, Date.now() - startedAt),
        metrics: {
          userTurns: metrics.userTurns,
          agentTurns: metrics.agentTurns,
          questionTopics: Array.from(metrics.topics),
          bookingClicked: metrics.bookingClicked,
          bookingUrlPresent: Boolean(bookingUrlRef.current),
          lastEvent: metrics.lastEvent,
          firstUserTurnAt: metrics.firstUserTurnAt ?? undefined,
        },
      }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  // Turn counters are derived from the full message history each time, so
  // repeated events stay idempotent.
  const handleMessageHistory = useCallback((messages: Message[]) => {
    const metrics = metricsRef.current;
    let userTurns = 0;
    let agentTurns = 0;
    for (const message of messages) {
      if (message.role === "user") {
        userTurns += 1;
        for (const topic of classifyQuestionTopics(message.content)) {
          metrics.topics.add(topic);
        }
      } else if (message.role === "persona") {
        agentTurns += 1;
      }
    }
    metrics.userTurns = userTurns;
    metrics.agentTurns = agentTurns;
    if (userTurns > 0) {
      if (!metrics.firstUserTurnAt) {
        metrics.firstUserTurnAt = new Date().toISOString();
        metrics.lastEvent = "first_user_turn";
      } else {
        metrics.lastEvent = "conversation";
      }
    }
  }, []);

  const handleBookingClick = useCallback(() => {
    const url = bookingUrlRef.current;
    if (!url) return;
    metricsRef.current.bookingClicked = true;
    metricsRef.current.lastEvent = "booking_clicked";
    const shareId = shareIdRef.current;
    if (shareId) trackBookingClicked({ shareId, surface: "live_page" });
    // Persist the click immediately in case the tab closes right after.
    sendHeartbeat();
    window.open(url, "_blank", "noopener,noreferrer");
  }, [sendHeartbeat]);

  const endSession = useCallback((reason: "manual" | "provider_closed" | "max_duration" | "unload" = "manual") => {
    clearMaxDurationTimer();
    clearHeartbeatTimer();
    recordSessionEnd(reason);

    if (clientRef.current) {
      try {
        clientRef.current.removeListener(AnamEvent.MESSAGE_HISTORY_UPDATED, handleMessageHistory);
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
  }, [clearMaxDurationTimer, clearHeartbeatTimer, recordSessionEnd, handleMessageHistory]);

  useEffect(() => {
    function handleBeforeUnload() {
      endSession("unload");
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      endSession("unload");
    };
  }, [endSession]);

  async function startSession() {
    if (startedRef.current) return;
    const id = (await params).id;
    shareIdRef.current = id;
    liveSessionIdRef.current = null;
    liveSessionSyncTokenRef.current = null;
    sessionSyncedRef.current = false;
    // Fresh per-session instrumentation; a pre-session booking click carries over.
    metricsRef.current = {
      userTurns: 0,
      agentTurns: 0,
      topics: new Set<string>(),
      bookingClicked: metricsRef.current.bookingClicked,
      lastEvent: "requested",
      firstUserTurnAt: null,
    };
    setStarting(true);
    setError(null);
    setErrorReason(null);
    trackLiveSessionRequested({ shareId: id });

    // Check microphone permission before starting
    try {
      if (typeof navigator !== "undefined" && navigator.permissions) {
        const perm = await navigator.permissions.query({ name: "microphone" as PermissionName });
        if (perm.state === "denied") {
          setError("Microphone access is blocked. Please allow microphone access in your browser settings to start the live conversation.");
          setErrorReason("mic");
          setStatus("Microphone access required");
          setStarting(false);
          return;
        }
      }
      // Also try getUserMedia to prompt for permission
      if (typeof navigator !== "undefined" && navigator.mediaDevices) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
        } catch {
          setError("Microphone access is required for the live conversation. Please allow access and try again.");
          setErrorReason("mic");
          setStatus("Microphone access required");
          setStarting(false);
          return;
        }
      }
    } catch {
      // Permissions API not available — proceed and let the SDK handle it
    }

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

      const data = (await res.json()) as { sessionToken: string; sessionId: string; syncToken: string };
      liveSessionIdRef.current = data.sessionId;
      liveSessionSyncTokenRef.current = data.syncToken;
      const client = createClient(data.sessionToken);
      clientRef.current = client;

      client.addListener(AnamEvent.CONNECTION_ESTABLISHED, () => {
        sessionStartedAtRef.current = Date.now();
        trackLiveSessionConnected({ shareId: id });
        setRetryCount(0);
        maxDurationTimerRef.current = setTimeout(() => {
          setStatus("Session limit reached");
          endSession("max_duration");
        }, LIVE_SESSION_MAX_DURATION_MS);
        heartbeatTimerRef.current = setInterval(sendHeartbeat, 15_000);
        setStatus("Connected — say hello!");
        setLive(true);
      });

      client.addListener(AnamEvent.CONNECTION_CLOSED, () => {
        clearMaxDurationTimer();
        clearHeartbeatTimer();
        recordSessionEnd("provider_closed");
        clientRef.current = null;
        startedRef.current = false;
        setStatus("Session ended");
        setLive(false);
      });

      client.addListener(AnamEvent.MESSAGE_HISTORY_UPDATED, handleMessageHistory);

      await client.streamToVideoElement("anam-video");
      startedRef.current = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start live session";
      clearMaxDurationTimer();
      clearHeartbeatTimer();
      sessionStartedAtRef.current = null;
      liveSessionIdRef.current = null;
      liveSessionSyncTokenRef.current = null;
      sessionSyncedRef.current = false;
      if (clientRef.current) {
        try {
          clientRef.current.removeListener(AnamEvent.MESSAGE_HISTORY_UPDATED, handleMessageHistory);
          clientRef.current.stopStreaming?.();
          (clientRef.current as { disconnect?: () => void }).disconnect?.();
        } catch {
          // best-effort cleanup after a failed start
        }
        clientRef.current = null;
      }
      trackLiveSessionFailed({ shareId: id, reason: message });
      const newRetryCount = retryCount + 1;
      setRetryCount(newRetryCount);
      // Classify the error for better messaging
      const lowerMessage = message.toLowerCase();
      const isProviderError = lowerMessage.includes("not configured") || lowerMessage.includes("configured") || lowerMessage.includes("token") || lowerMessage.includes("auth") || lowerMessage.includes("unavailable");
      setErrorReason(isProviderError ? "provider" : "connection");
      setError(message);
      setStatus(isProviderError ? "Live twin not configured" : "Click below to try again");
      startedRef.current = false;
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <LottieIcon name="spinner" className="w-10 h-10" />
      </div>
    );
  }

  if (notFound || !share) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-4">
          <Link href="/" className="font-display text-lg tracking-tight text-ink">
            nuncio
          </Link>
          <h1 className="font-display text-4xl tracking-tight">Live link expired</h1>
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
  const bookingUrl = share.bookingUrl && share.bookingUrl.startsWith("https://") ? share.bookingUrl : null;

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between">
        <Link
          href="/"
          className="font-display text-lg tracking-tight text-ink hover:text-ink-light transition-colors"
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
            {share.recipientName && (
              <p className="text-sm text-ink-faint mb-2">Hey {recipient}</p>
            )}
            <h1 className="font-display text-4xl md:text-5xl tracking-tight leading-[0.9] mb-3">
              Meet {sender} — anytime
            </h1>
            <p className="text-label-sm uppercase tracking-widest text-ink-faint font-medium">
              AI twin of {sender} · trained on their playbook · disclosed, never disguised
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
                  <p role="status" aria-live="polite" className="text-sm text-cream/70 mb-1">{status}</p>
                  {error && errorReason === "mic" && (
                    <p className="text-xs text-amber-300 mt-2 max-w-xs mx-auto">{error}</p>
                  )}
                  {error && errorReason !== "mic" && (
                    <p className="text-xs text-red-300 mt-2 max-w-xs mx-auto">{error}</p>
                  )}
                  {error && errorReason !== "mic" && (retryCount >= 2 || errorReason === "provider") && (
                    <Link
                      href={`/v/${share.id}`}
                      className="inline-flex items-center gap-1.5 mt-4 text-xs text-accent hover:text-accent/80 transition-colors"
                    >
                      <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 8h10M9 4l4 4-4 4" />
                      </svg>
                      Or watch the recorded video instead
                    </Link>
                  )}
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
                disabled={starting || errorReason === "provider"}
                aria-label={starting ? "Starting live conversation" : errorReason === "provider" ? "Live twin not configured" : "Start live conversation"}
                className="btn-press rounded-xl bg-accent text-white px-6 py-3 text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {starting ? (
                  <>
                    <LottieIcon name="spinner-light" className="w-4 h-4" />
                    Starting...
                  </>
                ) : errorReason === "provider" ? (
                  <>
                    Live twin unavailable
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
                onClick={() => endSession("manual")}
                aria-label="End live conversation"
                className="btn-press rounded-xl bg-warm text-white px-6 py-3 text-sm font-medium hover:bg-warm/90 transition-colors flex items-center gap-2"
              >
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="10" height="10" rx="2" />
                </svg>
                End conversation
              </button>
            )}
          </motion.div>

          {bookingUrl && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mt-3 flex justify-center"
            >
              <button
                onClick={() => {
                  if (share.mode === "reconnect") {
                    trackReconnectCatchupClicked({ shareId: share.id, surface: "live_page" });
                  }
                  handleBookingClick();
                }}
                aria-label={share.mode === "reconnect" ? `Let's catch up with ${sender}` : `Book time with ${sender}`}
                className="btn-press rounded-xl border border-ink/15 bg-white/70 text-ink px-5 py-2.5 text-sm font-medium hover:bg-white transition-colors flex items-center gap-2"
              >
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="3" width="12" height="11" rx="2" />
                  <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
                </svg>
                {share.mode === "reconnect" ? `Let's catch up with ${sender}` : `Book time with ${sender}`}
              </button>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 rounded-2xl border border-cream-dark bg-white/70 p-4"
          >
            <p className="text-label-sm uppercase tracking-widest text-ink-faint font-medium mb-2">
              How this works
            </p>
            <p className="text-xs text-ink-muted leading-relaxed">
              {share.mode === "reconnect"
                ? `This is an AI twin of ${sender}. It can answer questions about the message — but the card was built around a real memory they shared, and they reviewed every word before it was sent. You&apos;ll need to allow microphone access to talk. Your mic is only active while the session is running.`
                : `This is an AI avatar of ${sender}. It can answer questions, explain the reason for reaching out, and book a meeting — all within the sender&apos;s playbook. You&apos;ll need to allow microphone access to talk. Your mic is only active while the session is running.`}
            </p>
          </motion.div>
        </div>
      </main>

      <footer className="px-6 py-6 text-center">
        <p className="text-label-base text-ink-faint">
          Powered by{" "}
          <Link
            href={share.mode === "reconnect" ? `/?ref=live-${share.id}&mode=reconnect` : `/?ref=live-${share.id}`}
            onClick={() => trackViralCtaClicked({ shareId: share.id, ref: `live-${share.id}`, surface: "live_page" })}
            className="text-ink-muted hover:text-ink transition-colors font-medium"
          >
            nuncio
          </Link>{" "}
          — your intelligent emissary
        </p>
      </footer>
    </div>
  );
}
