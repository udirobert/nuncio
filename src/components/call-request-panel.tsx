"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { LiveCallRoom } from "@/components/live-call-room";

type PanelState =
  | "idle"
  | "pending"
  | "accepted"
  | "connecting"
  | "in_call"
  | "declined"
  | "expired"
  | "cancelled"
  | "ended";

interface JoinInfo {
  serverUrl: string;
  participantToken: string;
  roomName: string;
  expectedOtherIdentity: string | null;
  expiresAt: string;
  reusedRoom: boolean;
  identity: string;
}

const POLL_MS = 3_000;
const AVAILABILITY_POLL_MS = 5_000;

const TERMINAL_STATES: PanelState[] = ["declined", "expired", "cancelled"];

/**
 * Recipient side of the owner-approved call flow. Mounts on /live/[id] before
 * any paid twin session starts. The capability token lives only in component
 * memory — never in localStorage or the URL — so it dies with the tab.
 * Acceptance is shown as "Request accepted — connect", never as joined;
 * joined is only real room presence.
 */
export function CallRequestPanel({
  shareId,
  liveSessionId,
  syncToken,
  senderName,
  twinRoom,
  twinRoomName,
  onOwnerPresent,
  onHumanRoomConnected,
  onCallEnded,
}: {
  shareId: string;
  liveSessionId?: string | null;
  syncToken?: string | null;
  senderName: string;
  /** Connected Synthesia room the recipient is already in, if any. */
  twinRoom?: Room | null;
  twinRoomName?: string | null;
  /** Owner actually observed in the shared room — finalize twin telemetry. */
  onOwnerPresent?: () => void;
  /** A non-reused human room finished connecting — safe to stop the twin. */
  onHumanRoomConnected?: () => void;
  onCallEnded?: () => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [state, setState] = useState<PanelState>("idle");
  const [requestId, setRequestId] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const [join, setJoin] = useState<JoinInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const callbacksRef = useRef({ onOwnerPresent, onHumanRoomConnected, onCallEnded });
  useEffect(() => {
    callbacksRef.current = { onOwnerPresent, onHumanRoomConnected, onCallEnded };
  }, [onOwnerPresent, onHumanRoomConnected, onCallEnded]);
  useEffect(() => {
    requestIdRef.current = requestId;
  }, [requestId]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
  }, []);

  const clearRequest = useCallback(() => {
    stopPolling();
    tokenRef.current = null;
    requestIdRef.current = null;
    setRequestId(null);
    setJoin(null);
  }, [stopPolling]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/live/availability?shareId=${encodeURIComponent(shareId)}`);
        const data = res.ok ? await res.json() : null;
        if (cancelled) return;
        if (!data) {
          setAvailabilityError(true);
          setEnabled(false);
          return;
        }
        setAvailabilityError(false);
        setEnabled(Boolean(data.callRequestsEnabled));
        setAccepting(Boolean(data.acceptingCalls));
      } catch {
        if (cancelled) return;
        setAvailabilityError(true);
        setEnabled(false);
      }
    };
    void load();
    const timer = setInterval(() => void load(), AVAILABILITY_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
      stopPolling();
    };
  }, [shareId, stopPolling]);

  // Poll the request status while open. Terminal states always apply — a
  // cancel or expiry ends the call even mid-connect.
  const startPolling = useCallback((id: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const token = tokenRef.current;
      if (!token || requestIdRef.current !== id) return;
      if (pollAbortRef.current) return;
      const controller = new AbortController();
      pollAbortRef.current = controller;
      try {
        const res = await fetch(`/api/live/call-requests/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok) {
          setError((current) => current ?? "Connection check failed — retrying.");
          return;
        }
        const data = (await res.json()) as { status: PanelState; roomReady?: boolean };
        setError((current) => current === "Connection check failed — retrying." ? null : current);
        if (TERMINAL_STATES.includes(data.status)) {
          stopPolling();
          setJoin(null);
          setState(data.status);
          callbacksRef.current.onCallEnded?.();
        } else {
          setState((current) =>
            current === "in_call" || current === "connecting" ? current : data.status);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError((current) => current ?? "Connection check failed — retrying.");
        }
      } finally {
        if (pollAbortRef.current === controller) pollAbortRef.current = null;
      }
    }, POLL_MS);
  }, [stopPolling]);

  const requestCall = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/live/call-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId, liveSessionId: liveSessionId || undefined, syncToken: syncToken || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        requestId?: string; recipientToken?: string; error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not request a call right now");
        if (res.status === 409) setAccepting(false);
        return;
      }
      tokenRef.current = data.recipientToken || null;
      setRequestId(data.requestId || null);
      setJoin(null);
      setState("pending");
      if (data.requestId) startPolling(data.requestId);
    } catch {
      setError("Could not request a call right now");
    } finally {
      setBusy(false);
    }
  }, [shareId, liveSessionId, syncToken, startPolling, busy]);

  const fetchJoin = useCallback(async () => {
    const id = requestIdRef.current;
    const token = tokenRef.current;
    if (!id || !token) throw new Error("no request");
    const res = await fetch(`/api/live/call-requests/${id}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => ({}))) as JoinInfo & { error?: string; roomReady?: boolean };
    if (!res.ok) throw new Error(data.error || "join failed");
    return data;
  }, []);

  const connect = useCallback(async () => {
    if (!requestIdRef.current || !tokenRef.current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await fetchJoin();
      setJoin({
        serverUrl: data.serverUrl,
        participantToken: data.participantToken,
        roomName: data.roomName,
        expectedOtherIdentity: data.expectedOtherIdentity ?? null,
        expiresAt: data.expiresAt,
        reusedRoom: Boolean(data.reusedRoom),
        identity: data.identity,
      });
      setState("connecting");
    } catch {
      setError("Could not connect to the call");
    } finally {
      setBusy(false);
    }
  }, [busy, fetchJoin]);

  const getJoinCredentials = useCallback(async () => {
    const data = await fetchJoin();
    return { serverUrl: data.serverUrl, participantToken: data.participantToken };
  }, [fetchJoin]);

  const cancel = useCallback(async () => {
    const id = requestIdRef.current;
    const token = tokenRef.current;
    if (!id || !token) return;
    try {
      const res = await fetch(`/api/live/call-requests/${id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError("Could not cancel the request — try again.");
        return;
      }
    } catch {
      setError("Could not cancel the request — try again.");
      return;
    }
    stopPolling();
    setState("cancelled");
  }, [stopPolling]);

  const endRequested = useCallback(async () => {
    const id = requestIdRef.current;
    const token = tokenRef.current;
    if (!id || !token) return false;
    const res = await fetch(`/api/live/call-requests/${id}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => ({}))) as { cleanupError?: boolean };
    return !data.cleanupError;
  }, []);

  const reportPresence = useCallback(() => {
    const id = requestIdRef.current;
    const token = tokenRef.current;
    if (!id || !token) return;
    fetch(`/api/live/call-requests/${id}/presence`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }, []);

  if (!enabled && !requestId && state === "idle") return null;

  if ((state === "connecting" || state === "in_call") && join) {
    const borrowedRoom = join.reusedRoom && twinRoom && twinRoomName === join.roomName ? twinRoom : null;
    return (
      <div className="mt-4">
        <LiveCallRoom
          serverUrl={join.serverUrl}
          getJoinCredentials={getJoinCredentials}
          role="recipient"
          otherName={senderName}
          expectedOtherIdentity={join.expectedOtherIdentity}
          expiresAt={join.expiresAt}
          existingRoom={borrowedRoom}
          onConnected={() => {
            setState("in_call");
            if (!borrowedRoom) callbacksRef.current.onHumanRoomConnected?.();
          }}
          onOtherJoined={() => callbacksRef.current.onOwnerPresent?.()}
          onEndRequested={endRequested}
          onCleanupPending={() => setError("Call closed locally; server cleanup could not be confirmed.")}
          onPresenceHeartbeat={reportPresence}
          onEnded={() => {
            setState("ended");
            setJoin(null);
            callbacksRef.current.onCallEnded?.();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      {state === "idle" && accepting && (
        <button
          onClick={requestCall}
          disabled={busy}
          className="btn-press rounded-xl border border-ink/15 bg-white/70 text-ink px-5 py-2.5 text-body-sm font-medium hover:bg-white transition-colors disabled:opacity-50"
        >
          Request a call now
        </button>
      )}
      {state === "idle" && !accepting && (
        <p className="text-body-xs text-ink-faint">
          {availabilityError
            ? "Live call availability can't be confirmed right now"
            : `${senderName} isn't taking live calls right now`}
        </p>
      )}
      {state === "pending" && (
        <>
          <p role="status" aria-live="polite" className="text-body-sm text-ink-muted">
            Waiting for {senderName} to respond…
          </p>
          <button onClick={cancel} className="text-body-xs text-ink-faint hover:text-ink transition-colors underline">
            Cancel request
          </button>
        </>
      )}
      {state === "accepted" && (
        <button
          onClick={connect}
          disabled={busy}
          className="btn-press rounded-xl bg-accent text-white px-5 py-2.5 text-body-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          Request accepted — connect
        </button>
      )}
      {(state === "declined" || state === "expired" || state === "cancelled" || state === "ended") && (
        <>
          <p className="text-body-xs text-ink-muted">
            {state === "declined"
              ? `${senderName} can't take the call right now.`
              : state === "expired"
                ? "The request timed out."
                : state === "ended"
                  ? "Call ended."
                  : "Request cancelled."}
          </p>
          {accepting && state !== "ended" && (
            <button
              onClick={() => {
                clearRequest();
                setState("idle");
                void requestCall();
              }}
              disabled={busy}
              className="text-body-xs text-accent hover:text-accent/80 transition-colors underline disabled:opacity-50"
            >
              Request again
            </button>
          )}
        </>
      )}
      {error && <p className="text-body-xs text-warm">{error}</p>}
    </div>
  );
}
