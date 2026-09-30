"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LiveCallRoom } from "@/components/live-call-room";
import { LottieIcon } from "@/components/lottie-icon";
import { hasSenderPlaybook } from "@/lib/playbook";

interface CallRequestSummary {
  id: string;
  shareId: string;
  status: "pending" | "accepted" | "declined" | "expired" | "cancelled";
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  roomReady?: boolean;
  cleanupError?: boolean;
  timings?: { ownerResponseLatencyMs: number | null; humanConnectionLatencyMs: number | null };
  recipient: string | null;
  recipientRole: string | null;
  recipientCompany: string | null;
  questionTopics: string[];
  handoffContext?: {
    summary: string;
    interests: string[];
    unansweredQuestions: string[];
  } | null;
  liveBrief?: {
    goal: string;
    discussed: string;
    openQuestions: string;
    reason: string;
    source: "recipient_reviewed";
    sharedAt: string;
  } | null;
}

interface CallRequestSummaryStats {
  createdRequests: number;
  acceptedRequests: number;
  connectedRequests: number;
  acceptanceRate: number | null;
  connectionSuccessRate: number | null;
}

interface JoinInfo {
  serverUrl: string;
  participantToken: string;
  roomName: string;
  expectedOtherIdentity: string | null;
  expiresAt: string;
  reusedRoom?: boolean;
}

const POLL_MS = 5_000;

/**
 * Owner inbox for live call requests — honest first notification channel
 * (dashboard polling; push is still pending). Also carries the sender's
 * Synthesia avatar / ElevenLabs voice setup fields and the explicit,
 * expiring "available now" toggle. Nothing auto-connects: the mic is only
 * enabled by an explicit Connect press inside the room.
 */
function LiveBriefBlock({ brief }: { brief: NonNullable<CallRequestSummary["liveBrief"]> }) {
  const fields: [string, string][] = [
    ["What they want", brief.goal],
    ["What the AI explained", brief.discussed],
    ["Still unresolved", brief.openQuestions],
    ["Why they want to speak", brief.reason],
  ];
  return (
    <div className="mt-1.5 rounded-lg border border-accent/15 bg-accent-soft/30 px-3 py-2 space-y-1">
      <p className="text-body-xs text-ink-faint font-medium">Recipient-reviewed live brief</p>
      {fields.filter(([, v]) => v).map(([label, v]) => (
        <p key={label} className="text-body-xs text-ink-muted">
          <span className="text-ink-faint">{label}: </span>{v}
        </p>
      ))}
      <p className="text-[10px] text-ink-faint italic">
        Recipient-reviewed summary, not a verified transcript or sender commitment.
      </p>
    </div>
  );
}

export function CallRequestsCard() {
  const [accepting, setAccepting] = useState(false);
  const [callsEnabled, setCallsEnabled] = useState(false);
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);
  const [availabilityUntil, setAvailabilityUntil] = useState<string | null>(null);
  const [requests, setRequests] = useState<CallRequestSummary[]>([]);
  const [summary, setSummary] = useState<CallRequestSummaryStats | null>(null);
  const [summaryScope, setSummaryScope] = useState<string | null>(null);
  const [join, setJoin] = useState<(JoinInfo & { request: CallRequestSummary }) | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState(false);
  const [playbookConfigured, setPlaybookConfigured] = useState<boolean | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const mountedRef = useRef(true);
  const refreshAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    fetch("/api/account/brief")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mountedRef.current || !data) return;
        setPlaybookConfigured(hasSenderPlaybook({
          playbookWants: data.playbookWants,
          playbookOffer: data.playbookOffer,
          playbookConstraints: data.playbookConstraints,
        }));
      })
      .catch(() => {});
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (refreshAbortRef.current) return;
    const controller = new AbortController();
    refreshAbortRef.current = controller;
    try {
      const availabilityRes = await fetch("/api/live/availability", { signal: controller.signal });
      if (availabilityRes.ok) {
        const availability = (await availabilityRes.json()) as {
          acceptingCalls?: boolean;
          callAvailabilityUntil?: string | null;
          callRequestsEnabled?: boolean;
        };
        if (!mountedRef.current) return;
        setAccepting(Boolean(availability.acceptingCalls));
        setCallsEnabled(Boolean(availability.callRequestsEnabled));
        setAvailabilityUntil(availability.callAvailabilityUntil ?? null);
        setAvailabilityLoaded(true);
        setPollError(false);
      } else if (mountedRef.current) {
        setPollError(true);
      }
      const res = await fetch("/api/live/call-requests", { signal: controller.signal });
      if (!res.ok) {
        if (mountedRef.current) setPollError(true);
        return;
      }
      const data = (await res.json()) as {
        requests?: CallRequestSummary[];
        summary?: CallRequestSummaryStats;
        summaryScope?: string;
        cleanupErrors?: number;
        cleanupSweepFailed?: boolean;
      };
      if (!mountedRef.current) return;
      setRequests((data.requests || []).filter((r) => r.status === "pending" || r.status === "accepted"));
      setSummary(data.summary ?? null);
      setSummaryScope(data.summaryScope ?? null);
      setError((current) =>
        (data.cleanupErrors ?? 0) > 0 || data.cleanupSweepFailed
          ? "A room cleanup is still pending — it retries automatically."
          : current === "A room cleanup is still pending — it retries automatically."
            ? null
            : current);
    } catch {
      if (mountedRef.current && !controller.signal.aborted) setPollError(true);
    } finally {
      if (refreshAbortRef.current === controller) refreshAbortRef.current = null;
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void refresh());
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      clearInterval(timer);
      refreshAbortRef.current?.abort();
      refreshAbortRef.current = null;
    };
  }, [refresh]);

  useEffect(() => {
    if (!availabilityUntil) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (new Date(availabilityUntil).getTime() <= current) setAccepting(false);
    }, 1000);
    return () => clearInterval(timer);
  }, [availabilityUntil]);

  const secondsLeft = availabilityUntil
    ? Math.max(0, Math.ceil((new Date(availabilityUntil).getTime() - now) / 1000))
    : null;

  const toggleAvailability = useCallback(async () => {
    if (availabilityBusy) return;
    setAvailabilityBusy(true);
    setError(null);
    const next = !accepting;
    try {
      const res = await fetch("/api/live/availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: next }),
      });
      if (!res.ok) {
        setError("Could not update availability — try again.");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        acceptingCalls?: boolean;
        callAvailabilityUntil?: string | null;
      };
      setAccepting(Boolean(data.acceptingCalls));
      setAvailabilityUntil(data.callAvailabilityUntil ?? null);
    } catch {
      setError("Could not update availability — check your connection.");
    } finally {
      setAvailabilityBusy(false);
    }
  }, [accepting, availabilityBusy]);

  const decide = useCallback(async (id: string, action: "accept" | "decline") => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/live/call-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Could not update the request — try again.");
      }
      await refresh();
    } catch {
      setError("Could not update the request — check your connection.");
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  const joinCall = useCallback(async (request: CallRequestSummary) => {
    setBusy(request.id);
    setError(null);
    try {
      const res = await fetch(`/api/live/call-requests/${request.id}/join`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Could not join the call — try again.");
        return;
      }
      const data = (await res.json()) as JoinInfo;
      setJoin({ ...data, request });
    } catch {
      setError("Could not join the call — check your connection.");
    } finally {
      setBusy(null);
    }
  }, []);

  const getJoinCredentials = useCallback(async () => {
    if (!join) throw new Error("no active call");
    const res = await fetch(`/api/live/call-requests/${join.request.id}/join`, { method: "POST" });
    if (!res.ok) throw new Error("join failed");
    const data = (await res.json()) as JoinInfo;
    return { serverUrl: data.serverUrl, participantToken: data.participantToken };
  }, [join]);

  const endCallRequest = useCallback(async (request: CallRequestSummary) => {
    const res = await fetch(`/api/live/call-requests/${request.id}/cancel`, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    void refresh();
    if (!res || !res.ok) return false;
    const data = (await res.json().catch(() => ({}))) as { cleanupError?: boolean };
    return !data.cleanupError;
  }, [refresh]);

  // While a call is open, keep polling its status — a remote cancel or expiry
  // ends the room for both sides.
  useEffect(() => {
    if (!join) return;
    const requestId = join.request.id;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/live/call-requests/${requestId}`);
        if (!res.ok || !mountedRef.current) return;
        const data = (await res.json()) as { status?: string };
        if (data.status === "declined" || data.status === "expired" || data.status === "cancelled") {
          if (mountedRef.current) setJoin(null);
        }
      } catch {
        // transient poll failure — next tick retries
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [join]);

  if (join) {
    return (
      <div className="rounded-2xl border border-cream-dark bg-white/70 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">Live call</h2>
          <button
            onClick={() => setJoin(null)}
            className="text-body-xs text-ink-faint hover:text-ink transition-colors underline"
          >
            Leave call view
          </button>
        </div>
        {join.request.liveBrief && <LiveBriefBlock brief={join.request.liveBrief} />}
        {join.request.handoffContext && (
          <div className="rounded-xl border border-ink/10 bg-cream/40 px-3 py-2 space-y-1">
            <p className="text-body-xs text-ink-faint font-medium">Text conversation context</p>
            {join.request.handoffContext.summary && (
              <p className="text-body-xs text-ink-muted">{join.request.handoffContext.summary}</p>
            )}
            {join.request.handoffContext.interests.length > 0 && (
              <p className="text-body-xs text-ink-muted">
                Interests: {join.request.handoffContext.interests.join(", ")}
              </p>
            )}
            {join.request.handoffContext.unansweredQuestions.length > 0 && (
              <p className="text-body-xs text-ink-muted">
                Unanswered: {join.request.handoffContext.unansweredQuestions.join(" · ")}
              </p>
            )}
          </div>
        )}
        <LiveCallRoom
          serverUrl={join.serverUrl}
          getJoinCredentials={getJoinCredentials}
          autoConnect
          role="owner"
          otherName={join.request.recipient || "the recipient"}
          expectedOtherIdentity={join.expectedOtherIdentity}
          expiresAt={join.expiresAt}
          onEnded={() => setJoin(null)}
          onEndRequested={() => endCallRequest(join.request)}
          onCleanupPending={() => setError("Call closed locally; server cleanup could not be confirmed.")}
          onPresenceHeartbeat={() => {
            fetch(`/api/live/call-requests/${join.request.id}/presence`, { method: "POST" }).catch(() => {});
          }}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-cream-dark bg-white/70 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">Call requests</h2>
        {availabilityLoaded && (
          <button
            onClick={toggleAvailability}
            disabled={availabilityBusy || !callsEnabled}
            role="switch"
            aria-checked={accepting}
            className={`btn-press rounded-xl px-3 py-1.5 text-body-xs font-medium transition-colors disabled:opacity-50 ${
              accepting ? "bg-accent text-white" : "border border-ink/15 text-ink-muted hover:text-ink"
            }`}
          >
            {accepting ? "Available for calls" : "Go available"}
          </button>
        )}
      </div>
      {availabilityLoaded && !callsEnabled && (
        <p className="text-body-xs text-ink-faint">
          Live calls need a LiveKit backend and an allowlisted workspace — call setup isn&apos;t active yet.
        </p>
      )}
      {pollError && (
        <p className="text-body-xs text-warm">Inbox refresh failed — retrying automatically.</p>
      )}
      {playbookConfigured === null && (
        <p className="text-body-xs text-ink-faint">Readiness couldn&apos;t be confirmed — check your playbook setup.</p>
      )}
      {playbookConfigured === false && (
        <p className="text-body-xs text-warm leading-relaxed">
          Your sender playbook isn&apos;t configured — your AI representative answers from general
          guidance only.{" "}
          <a href="/dashboard?view=setup" className="underline text-accent hover:text-accent/80 transition-colors">
            Set up your playbook
          </a>
          .
        </p>
      )}
      <p className="text-body-xs text-ink-faint leading-relaxed">
        The pilot avatar is a representative persona and may not resemble you.
      </p>
      <p className="text-body-xs text-ink-faint leading-relaxed">
        Keep this dashboard open to receive requests. Availability ends after 15 minutes —
        recipients can request a call only while it&apos;s on. The representative never promises you&apos;re reachable.
        {accepting && secondsLeft !== null && secondsLeft > 0 && (
          <> Window closes in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}.</>
        )}
      </p>
      {error && <p className="text-body-xs text-warm">{error}</p>}
      {summary && summary.createdRequests > 0 && (
        <p className="text-body-xs text-ink-faint">
          {summary.createdRequests} requested · {summary.acceptedRequests} accepted · {summary.connectedRequests} connected
          {summaryScope ? ` (${summaryScope})` : ""}
        </p>
      )}

      {requests.length === 0 ? (
        <p className="text-body-sm text-ink-muted">No open call requests.</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => (
            <li key={request.id} className="rounded-xl border border-ink/10 bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-body-sm font-medium text-ink">
                    {request.recipient || "A visitor"}
                    {request.recipientRole ? `, ${request.recipientRole}` : ""}
                    {request.recipientCompany ? ` at ${request.recipientCompany}` : ""}
                  </p>
                  {request.questionTopics.length > 0 && (
                    <p className="text-body-xs text-ink-faint mt-0.5">
                      Asked about: {request.questionTopics.join(", ")}
                    </p>
                  )}
                  {request.liveBrief && <LiveBriefBlock brief={request.liveBrief} />}
                  {request.handoffContext && (
                    <div className="mt-1.5 rounded-lg border border-ink/10 bg-cream/40 px-3 py-2 space-y-1">
                      <p className="text-body-xs text-ink-faint font-medium">Text conversation context</p>
                      {request.handoffContext.summary && (
                        <p className="text-body-xs text-ink-muted">{request.handoffContext.summary}</p>
                      )}
                      {request.handoffContext.interests.length > 0 && (
                        <p className="text-body-xs text-ink-muted">
                          Interests: {request.handoffContext.interests.join(", ")}
                        </p>
                      )}
                      {request.handoffContext.unansweredQuestions.length > 0 && (
                        <p className="text-body-xs text-ink-muted">
                          Unanswered: {request.handoffContext.unansweredQuestions.join(" · ")}
                        </p>
                      )}
                    </div>
                  )}
                  <p className="text-body-xs text-ink-faint mt-0.5">
                    {request.status === "pending"
                      ? "Waiting for your response"
                      : request.roomReady
                        ? "Accepted — ready to join"
                        : "Accepted — opening the room…"}
                    {request.timings?.ownerResponseLatencyMs != null &&
                      ` · responded in ${Math.round(request.timings.ownerResponseLatencyMs / 1000)}s`}
                    {request.cleanupError && " · room cleanup pending"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {request.status === "pending" && (
                    <>
                      <button
                        onClick={() => decide(request.id, "accept")}
                        disabled={busy === request.id}
                        className="btn-press rounded-lg bg-accent text-white px-3 py-1.5 text-body-xs font-medium disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => decide(request.id, "decline")}
                        disabled={busy === request.id}
                        className="btn-press rounded-lg border border-ink/15 text-ink-muted px-3 py-1.5 text-body-xs font-medium hover:text-ink disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {request.status === "accepted" && request.roomReady && (
                    <button
                      onClick={() => joinCall(request)}
                      disabled={busy === request.id}
                      className="btn-press rounded-lg bg-ink text-cream px-3 py-1.5 text-body-xs font-medium disabled:opacity-50"
                    >
                      {busy === request.id ? <LottieIcon name="spinner-light" className="w-3 h-3" /> : "Join call"}
                    </button>
                  )}
                  {request.status === "accepted" && !request.roomReady && (
                    <span className="text-body-xs text-ink-faint">Preparing…</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

    </div>
  );
}
