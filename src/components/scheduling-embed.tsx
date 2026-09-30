"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resolveSchedulingProvider } from "@/lib/scheduling";
import type { LiveCallBrief, BriefDialogueMessage } from "@/lib/live-call-brief";

interface SchedulingEmbedProps {
  shareId: string;
  senderName: string;
  bookingUrl: string;
  getBriefDialogue?: () => BriefDialogueMessage[];
  sessionProof?: { id: string; syncToken: string } | null;
  onBookingClicked?: () => void;
  onOpenChange?: (open: boolean) => void;
}

const CAL_EMBED_SCRIPT = "https://app.cal.com/embed/embed.js";
const CAL_LOAD_TIMEOUT_MS = 20_000;
const REQUEST_TIMEOUT_MS = 20_000;

function timedSignal(controller: AbortController): AbortSignal {
  if (typeof AbortSignal.any === "function" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.any([controller.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  }
  const fallback = new AbortController();
  const timer = setTimeout(() => fallback.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => fallback.abort();
  controller.signal.addEventListener("abort", onAbort, { once: true });
  fallback.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  return fallback.signal;
}

type CalApi = ((...args: unknown[]) => void) & {
  loaded?: boolean;
  q?: unknown[];
  ns?: Record<string, CalApi>;
};

type CalWindow = { Cal?: CalApi };

function installCalStub(): CalApi {
  const w = window as unknown as CalWindow;
  if (w.Cal) return w.Cal;
  const push = (api: CalApi, ar: unknown[]) => {
    api.q = api.q || [];
    api.q.push(ar);
  };
  const cal = ((...args: unknown[]) => {
    if (args[0] === "init" && typeof args[1] === "string") {
      const namespace = args[1];
      cal.ns = cal.ns || {};
      if (!cal.ns[namespace]) {
        const api = ((...a: unknown[]) => push(api, a)) as CalApi;
        api.q = [];
        cal.ns[namespace] = api;
      }
      push(cal.ns[namespace], args);
      push(cal, ["initNamespace", namespace]);
      return;
    }
    push(cal, args);
  }) as CalApi;
  cal.loaded = false;
  cal.ns = {};
  cal.q = [];
  w.Cal = cal;
  return cal;
}

let calScriptPromise: Promise<void> | null = null;
let calScriptEl: HTMLScriptElement | null = null;

function loadCalEmbed(): Promise<void> {
  if (calScriptPromise) return calScriptPromise;
  calScriptPromise = new Promise<void>((resolve, reject) => {
    const w = window as unknown as CalWindow;
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CAL_EMBED_SCRIPT}"]`);
    if (existing && w.Cal?.loaded) {
      resolve();
      return;
    }
    installCalStub();
    const finish = (fn: () => void) => {
      clearTimeout(timer);
      fn();
    };
    const cleanup = (fn: (e: Error) => void, err: Error) => {
      if (calScriptEl) {
        calScriptEl.remove();
        calScriptEl = null;
      }
      calScriptPromise = null;
      finish(() => fn(err));
    };
    const timer = setTimeout(() => {
      cleanup(reject, new Error("cal embed load timed out"));
    }, CAL_LOAD_TIMEOUT_MS);
    let script = existing && existing.dataset.calState !== "failed" ? existing : null;
    if (script && script.dataset.calState === "loading") {
      script.addEventListener("load", () => finish(resolve), { once: true });
      script.addEventListener("error", () => cleanup(reject, new Error("cal embed failed to load")), { once: true });
      return;
    }
    script = document.createElement("script");
    script.src = CAL_EMBED_SCRIPT;
    script.async = true;
    script.dataset.calState = "loading";
    calScriptEl = script;
    script.onload = () => {
      script.dataset.calState = "loaded";
      calScriptEl = null;
      finish(resolve);
    };
    script.onerror = () => {
      script.dataset.calState = "failed";
      cleanup(reject, new Error("cal embed failed to load"));
    };
    document.head.appendChild(script);
  });
  return calScriptPromise;
}

function calNamespace(ns: string): CalApi | null {
  const w = window as unknown as CalWindow;
  if (!w.Cal) return null;
  w.Cal("init", ns, { origin: "https://cal.com" });
  return w.Cal.ns?.[ns] ?? null;
}

function calLinkConfig(url: string, contextToken: string | null): Record<string, string> | null {
  try {
    const parsed = new URL(url);
    const config: Record<string, string> = {};
    for (const [key, value] of parsed.searchParams) {
      if (key.startsWith("metadata[")) return null;
      config[key] = value;
    }
    if (contextToken) config["metadata[nuncioContext]"] = contextToken;
    return config;
  } catch {
    return null;
  }
}

export function SchedulingEmbed({
  shareId,
  senderName,
  bookingUrl,
  getBriefDialogue,
  sessionProof,
  onBookingClicked,
  onOpenChange,
}: SchedulingEmbedProps) {
  const provider = resolveSchedulingProvider(bookingUrl);
  const providerId = provider?.id ?? null;
  const [open, setOpen] = useState(false);
  const [openNonce, setOpenNonce] = useState(0);
  const [embedState, setEmbedState] = useState<"idle" | "loading" | "ready" | "submitted" | "error">("idle");
  const [tracked, setTracked] = useState<"pending" | "tracked" | "untracked" | "failed">("pending");
  const [contextToken, setContextToken] = useState<string | null>(null);
  const [contextError, setContextError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [brief, setBrief] = useState<LiveCallBrief | null>(null);
  const [briefDrafting, setBriefDrafting] = useState(false);
  const [briefError, setBriefError] = useState(false);
  const [attachBrief, setAttachBrief] = useState(false);
  const [iframeNonce, setIframeNonce] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const genRef = useRef(0);
  const busyRef = useRef(false);
  const probeAbortRef = useRef<AbortController | null>(null);
  const draftAbortRef = useRef<AbortController | null>(null);
  const contextAbortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nsRef = useRef<string | null>(null);

  const setOpenNotify = useCallback((next: boolean) => {
    setOpen(next);
    if (next) setOpenNonce((n) => n + 1);
    onOpenChange?.(next);
  }, [onOpenChange]);

  const resetEmbed = useCallback(() => {
    genRef.current += 1;
    busyRef.current = false;
    probeAbortRef.current?.abort();
    draftAbortRef.current?.abort();
    contextAbortRef.current?.abort();
    probeAbortRef.current = null;
    draftAbortRef.current = null;
    contextAbortRef.current = null;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    nsRef.current = null;
    if (containerRef.current) containerRef.current.innerHTML = "";
    setEmbedState("idle");
    setContextError(false);
    setContextToken(null);
    setSubmitting(false);
    setTracked("pending");
    setAttachBrief(false);
    setBrief(null);
    setBriefDrafting(false);
    setBriefError(false);
  }, []);

  useEffect(() => () => {
    resetEmbed();
  }, [resetEmbed]);

  const close = useCallback(() => {
    resetEmbed();
    setOpenNotify(false);
  }, [resetEmbed, setOpenNotify]);

  useEffect(() => {
    queueMicrotask(() => close());
  }, [bookingUrl, shareId, sessionProof?.id, close]);

  useEffect(() => {
    if (!open || providerId !== "calcom") return;
    const gen = genRef.current;
    const controller = new AbortController();
    probeAbortRef.current = controller;
    fetch(`/api/scheduling/context?shareId=${encodeURIComponent(shareId)}`, { cache: "no-store", signal: timedSignal(controller) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("context probe failed"))))
      .then((data: { tracked?: boolean }) => {
        if (genRef.current === gen) setTracked(data?.tracked ? "tracked" : "untracked");
      })
      .catch(() => {
        if (genRef.current === gen) setTracked("failed");
      });
  }, [open, openNonce, providerId, shareId]);

  const draftBrief = useCallback(async () => {
    if (!sessionProof || !getBriefDialogue) return;
    setBriefDrafting(true);
    setBriefError(false);
    const gen = genRef.current;
    const controller = new AbortController();
    draftAbortRef.current = controller;
    try {
      const res = await fetch("/api/live/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: timedSignal(controller),
        body: JSON.stringify({
          shareId,
          sessionId: sessionProof.id,
          syncToken: sessionProof.syncToken,
          consent: true,
          messages: getBriefDialogue(),
        }),
      });
      if (!res.ok) throw new Error("draft failed");
      const data = (await res.json()) as { brief?: LiveCallBrief };
      if (genRef.current !== gen) return;
      if (data.brief) {
        setBrief(data.brief);
        setAttachBrief(false);
      } else {
        setBriefError(true);
      }
    } catch {
      if (genRef.current === gen) setBriefError(true);
    } finally {
      if (genRef.current === gen) setBriefDrafting(false);
    }
  }, [shareId, sessionProof, getBriefDialogue]);

  const mountCalcom = useCallback((gen: number, contextToken: string | null) => {
    setEmbedState("loading");
    const run = async () => {
      await loadCalEmbed();
      if (genRef.current !== gen) return;
      const container = containerRef.current;
      const config = calLinkConfig(bookingUrl, contextToken);
      if (!container || !config) {
        setEmbedState("error");
        return;
      }
      const ns = `nuncio-${shareId}-${gen}`;
      nsRef.current = ns;
      const api = calNamespace(ns);
      if (!api) {
        setEmbedState("error");
        return;
      }
      api("on", {
        action: "linkReady",
        callback: () => {
          if (genRef.current !== gen || nsRef.current !== ns) return;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setEmbedState("ready");
        },
      });
      api("on", {
        action: "linkFailed",
        callback: () => {
          if (genRef.current !== gen || nsRef.current !== ns) return;
          setEmbedState("error");
        },
      });
      api("on", {
        action: "bookingSuccessfulV2",
        callback: () => {
          if (genRef.current !== gen || nsRef.current !== ns) return;
          setEmbedState("submitted");
        },
      });
      api("inline", {
        elementOrSelector: container,
        calLink: new URL(bookingUrl).pathname.replace(/^\/+/, ""),
        config,
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (genRef.current === gen && nsRef.current === ns) setEmbedState((s) => (s === "loading" ? "error" : s));
      }, CAL_LOAD_TIMEOUT_MS);
    };
    run().catch(() => {
      if (genRef.current === gen) setEmbedState("error");
    });
  }, [bookingUrl, shareId]);

  const continueScheduling = useCallback(async (withBrief: boolean, skipContext = false) => {
    if (!provider || busyRef.current) return;
    busyRef.current = true;
    const gen = genRef.current;
    onBookingClicked?.();

    if (provider.id === "link") {
      window.open(provider.url, "_blank", "noopener,noreferrer");
      busyRef.current = false;
      return;
    }
    if (provider.id === "calendly") {
      setEmbedState("loading");
      timeoutRef.current = setTimeout(() => {
        if (genRef.current === gen) setEmbedState((s) => (s === "loading" ? "error" : s));
      }, CAL_LOAD_TIMEOUT_MS);
      busyRef.current = false;
      return;
    }

    setEmbedState("loading");
    setContextError(false);
    let token: string | null = null;
    if (tracked === "tracked" && !skipContext) {
      const controller = new AbortController();
      contextAbortRef.current = controller;
      setSubmitting(true);
      try {
        const res = await fetch("/api/scheduling/context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: timedSignal(controller),
          body: JSON.stringify({
            shareId,
            liveSessionId: sessionProof?.id,
            syncToken: sessionProof?.syncToken,
            briefConsent: withBrief && Boolean(brief),
            liveBrief: withBrief ? brief : undefined,
          }),
        });
        if (!res.ok) throw new Error("context failed");
        const data = (await res.json()) as { contextToken?: string };
        if (genRef.current !== gen) return;
        if (typeof data.contextToken !== "string" || !data.contextToken) throw new Error("context token missing");
        token = data.contextToken;
        setContextToken(token);
      } catch {
        if (genRef.current !== gen) return;
        setContextError(true);
        setEmbedState("idle");
        setSubmitting(false);
        busyRef.current = false;
        return;
      }
      setSubmitting(false);
    } else if (skipContext) {
      setTracked("untracked");
      setContextToken(null);
    }
    if (genRef.current !== gen) return;
    mountCalcom(gen, token);
    busyRef.current = false;
  }, [provider, tracked, shareId, sessionProof, brief, mountCalcom, onBookingClicked]);

  const retryEmbed = useCallback(() => {
    if (!provider) return;
    if (containerRef.current) containerRef.current.innerHTML = "";
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    nsRef.current = null;
    genRef.current += 1;
    const gen = genRef.current;
    if (provider.id === "calcom") {
      mountCalcom(gen, contextToken);
    } else if (provider.id === "calendly") {
      setIframeNonce((n) => n + 1);
      setEmbedState("loading");
      timeoutRef.current = setTimeout(() => {
        if (genRef.current === gen) setEmbedState((s) => (s === "loading" ? "error" : s));
      }, CAL_LOAD_TIMEOUT_MS);
    } else {
      setEmbedState("idle");
    }
  }, [provider, contextToken, mountCalcom]);

  useEffect(() => {
    if (providerId !== "calendly" || embedState !== "ready") return;
    const listener = (event: MessageEvent) => {
      if (event.origin !== "https://calendly.com") return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { event?: unknown } | null;
      if (!data || typeof data !== "object" || Array.isArray(data)) return;
      if (data.event === "calendly.event_scheduled") setEmbedState("submitted");
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [providerId, embedState]);

  if (!provider) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpenNotify(true)}
        className="w-full min-h-[44px] rounded-xl border border-ink/15 bg-white/70 px-4 py-2.5 text-sm font-medium text-ink hover:bg-white"
      >
        Choose a time with {senderName}
      </button>
    );
  }

  const briefOffered = provider.id === "calcom" && tracked === "tracked" && Boolean(sessionProof && getBriefDialogue);

  return (
    <div className="rounded-xl border border-cream-dark bg-white/70 p-4 text-left">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink">Schedule time with {senderName}</p>
        <button
          type="button"
          onClick={close}
          className="min-h-[44px] min-w-[44px] text-sm text-ink-faint hover:text-ink"
          aria-label="Close scheduling"
        >
          Close
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Scheduling is provided by {provider.host}. When you continue, that service receives the details you enter into its booking form.
      </p>
      {provider.id === "calcom" && tracked === "untracked" ? (
        <p className="mt-1 text-sm text-ink-muted">Booking status isn&apos;t tracked in nuncio for this link.</p>
      ) : null}
      {provider.id === "calcom" && tracked === "failed" ? (
        <p className="mt-1 text-sm text-ink-muted">Couldn&apos;t verify booking tracking — this scheduling link works but nuncio won&apos;t record the booking.</p>
      ) : null}

      {briefOffered ? (
        <div className="mt-3">
          {!brief ? (
            <div>
              <p className="text-sm text-ink-muted">
                Optional: draft a short brief for {senderName}. Drafting sends this conversation&apos;s recent dialogue to nuncio&apos;s AI service.
              </p>
              <button
                type="button"
                onClick={() => void draftBrief()}
                disabled={briefDrafting}
                className="mt-1 min-h-[44px] rounded-lg border border-cream-dark px-3 text-sm text-ink-muted hover:text-ink disabled:opacity-50"
              >
                {briefDrafting ? "Drafting brief…" : `Draft a brief for ${senderName}`}
              </button>
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-cream-dark p-3">
              <p className="text-body-xs text-ink-faint font-medium">Review your brief — editing clears the share checkbox.</p>
              {([["goal", "What you want"], ["discussed", "What the AI explained"], ["openQuestions", "Still unresolved"], ["reason", "Why you want to speak"]] as const).map(([key, label]) => (
                <label key={key} className="block text-sm text-ink-muted">
                  <span className="text-ink-faint">{label}</span>
                  <textarea
                    className="mt-0.5 w-full rounded border border-cream-dark bg-transparent p-1.5 text-sm text-ink"
                    rows={2}
                    maxLength={500}
                    value={brief[key]}
                    disabled={submitting || embedState !== "idle"}
                    onChange={(e) => {
                      setBrief({ ...brief, [key]: e.target.value });
                      setAttachBrief(false);
                    }}
                  />
                </label>
              ))}
              <label className="flex items-start gap-2 text-sm text-ink-muted">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={attachBrief}
                  disabled={submitting || embedState !== "idle"}
                  onChange={(e) => setAttachBrief(e.target.checked)}
                />
                Save this reviewed brief for {senderName} with my scheduling request (stored by nuncio; never sent to the scheduling provider)
              </label>
            </div>
          )}
          {briefError ? <p className="mt-1 text-sm text-ink-muted">Brief draft unavailable — you can still schedule.</p> : null}
        </div>
      ) : null}

      {embedState === "idle" ? (
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={() => void continueScheduling(attachBrief)}
            disabled={tracked === "pending" && provider.id === "calcom"}
            className="w-full min-h-[44px] rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-cream disabled:opacity-50"
          >
            {provider.id === "link" ? `Open ${provider.host} in a new tab` : "Continue to scheduling"}
          </button>
          {contextError ? (
            <div className="space-y-1">
              <p className="text-sm text-warm" role="alert">Couldn&apos;t start tracked scheduling — the brief was not shared.</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setContextError(false); void continueScheduling(attachBrief); }}
                  className="min-h-[44px] rounded-lg border border-cream-dark px-3 text-sm text-ink"
                >
                  Retry
                </button>
                {brief && attachBrief ? (
                  <button
                    type="button"
                    onClick={() => { setAttachBrief(false); setContextError(false); void continueScheduling(false, true); }}
                    className="min-h-[44px] rounded-lg border border-cream-dark px-3 text-sm text-ink-muted"
                  >
                    Continue without a brief
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {embedState === "loading" ? <p className="mt-3 text-sm text-ink-muted" role="status">Loading scheduler…</p> : null}
      {embedState === "error" ? (
        <div className="mt-3">
          <p className="text-sm text-ink-muted">The scheduler could not load in this page.</p>
          <button
            type="button"
            onClick={retryEmbed}
            className="mt-1 min-h-[44px] rounded-lg border border-cream-dark px-3 text-sm text-ink"
          >
            Retry
          </button>
        </div>
      ) : null}
      {embedState === "submitted" ? (
        <p className="mt-3 text-sm text-ink-muted" role="status">
          {provider.id === "calcom" && tracked === "tracked"
            ? "Booking submitted. The sender’s dashboard will show provider confirmation when received."
            : "Booking submitted in the provider — reported by your browser, not confirmed."}
        </p>
      ) : null}

      {provider.id === "calcom" ? (
        <div ref={containerRef} className={embedState === "loading" || embedState === "idle" ? "hidden" : "mt-3 w-full"} />
      ) : null}
      {provider.id === "calendly" && embedState !== "idle" ? (
        <iframe
          key={iframeNonce}
          ref={iframeRef}
          title={`Schedule with ${senderName}`}
          src={`${provider.url}${provider.url.includes("?") ? "&" : "?"}embed_domain=${encodeURIComponent(window.location.hostname)}&embed_type=Inline`}
          className="mt-3 h-[560px] w-full rounded-lg border border-cream-dark"
          onLoad={() => setEmbedState((s) => (s === "loading" ? "ready" : s))}
          onError={() => setEmbedState("error")}
        />
      ) : null}

      <a
        href={(() => {
          if (provider.id === "calcom" && contextToken) {
            try {
              const u = new URL(provider.url);
              u.searchParams.set("metadata[nuncioContext]", contextToken);
              return u.toString();
            } catch {
              return provider.url;
            }
          }
          return provider.url;
        })()}
        onClick={() => onBookingClicked?.()}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block min-h-[44px] text-sm text-ink-muted underline underline-offset-2"
      >
        Open {provider.host} in a new tab
      </a>
    </div>
  );
}
