"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { LiveCallRoom } from "@/components/live-call-room";
import {
  LIVE_CALL_BRIEF_FIELD_LIMIT,
  type BriefDialogueMessage,
  type LiveCallBrief,
} from "@/lib/live-call-brief";

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
 * Acceptance is shown as preparing until join credentials resolve, never as
 * joined; joined is only real room presence.
 */
export function CallRequestPanel({
  shareId,
  liveSessionId,
  syncToken,
  senderName,
  twinRoom,
  twinRoomName,
  ownerArrived,
  onCallReady,
  onOwnerPresent,
  onHumanRoomConnected,
  onCallEnded,
  getBriefDialogue,
}: {
  shareId: string;
  liveSessionId?: string | null;
  syncToken?: string | null;
  senderName: string;
  /** Connected Synthesia room the recipient is already in, if any. */
  twinRoom?: Room | null;
  twinRoomName?: string | null;
  /** Page observed the bound owner identity inside the live room. */
  ownerArrived?: boolean;
  /** Join binding fetched after acceptance (identity proof only, no connect). */
  onCallReady?: (info: { roomName: string; expectedOtherIdentity: string | null; reusedRoom: boolean }) => void;
  /** Owner actually observed in the shared room — finalize twin telemetry. */
  onOwnerPresent?: () => void;
  /** A non-reused human room finished connecting — safe to stop the twin. */
  onHumanRoomConnected?: () => void;
  onCallEnded?: () => void;
  /** Ephemeral in-memory dialogue snapshot for the opt-in brief draft. */
  getBriefDialogue?: () => BriefDialogueMessage[];
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
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefDraft, setBriefDraft] = useState<LiveCallBrief>({ goal: "", discussed: "", openQuestions: "", reason: "" });
  const [briefShare, setBriefShare] = useState(false);
  const [briefDrafting, setBriefDrafting] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const joinFetchedRef = useRef(false);
  const genRef = useRef(0);
  const joinAbortRef = useRef<AbortController | null>(null);
  const briefAbortRef = useRef<AbortController | null>(null);
  const briefGenRef = useRef(0);
  const liveSessionRef = useRef<string | null | undefined>(liveSessionId);

  const callbacksRef = useRef({ onCallReady, onOwnerPresent, onHumanRoomConnected, onCallEnded });
  useEffect(() => {
    callbacksRef.current = { onCallReady, onOwnerPresent, onHumanRoomConnected, onCallEnded };
  }, [onCallReady, onOwnerPresent, onHumanRoomConnected, onCallEnded]);
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

  const clearBrief = useCallback(() => {
    briefGenRef.current += 1;
    briefAbortRef.current?.abort();
    briefAbortRef.current = null;
    setBriefDrafting(false);
    setBriefOpen(false);
    setBriefDraft({ goal: "", discussed: "", openQuestions: "", reason: "" });
    setBriefShare(false);
    setBriefError(null);
  }, []);

  const clearRequest = useCallback(() => {
    genRef.current += 1;
    stopPolling();
    joinAbortRef.current?.abort();
    joinAbortRef.current = null;
    tokenRef.current = null;
    requestIdRef.current = null;
    setRequestId(null);
    setJoin(null);
    joinFetchedRef.current = false;
    clearBrief();
  }, [stopPolling, clearBrief]);

  useEffect(() => {
    if (liveSessionRef.current === liveSessionId) return;
    liveSessionRef.current = liveSessionId;
    clearBrief();
  }, [liveSessionId, clearBrief]);

  useEffect(() => () => {
    genRef.current += 1;
    briefGenRef.current += 1;
    joinAbortRef.current?.abort();
    briefAbortRef.current?.abort();
  }, []);

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

  const fetchJoin = useCallback(async (signal?: AbortSignal) => {
    const id = requestIdRef.current;
    const token = tokenRef.current;
    if (!id || !token) throw new Error("no request");
    const res = await fetch(`/api/live/call-requests/${id}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    const data = (await res.json().catch(() => ({}))) as JoinInfo & { error?: string; roomReady?: boolean };
    if (!res.ok) throw new Error(data.error || "join failed");
    return data;
  }, []);

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
          genRef.current += 1;
          stopPolling();
          joinAbortRef.current?.abort();
          joinAbortRef.current = null;
          setJoin(null);
          setState(data.status);
          clearBrief();
          callbacksRef.current.onCallEnded?.();
        } else {
          setState((current) =>
            current === "in_call" || current === "connecting" ? current : data.status);
          if (data.status === "accepted" && data.roomReady && !joinFetchedRef.current) {
            joinFetchedRef.current = true;
            const generation = genRef.current;
            const joinController = new AbortController();
            joinAbortRef.current = joinController;
            fetchJoin(joinController.signal)
              .then((info) => {
                if (joinAbortRef.current === joinController) joinAbortRef.current = null;
                if (joinController.signal.aborted
                  || genRef.current !== generation
                  || requestIdRef.current !== id || !tokenRef.current) return;
                setJoin({
                  serverUrl: info.serverUrl,
                  participantToken: info.participantToken,
                  roomName: info.roomName,
                  expectedOtherIdentity: info.expectedOtherIdentity ?? null,
                  expiresAt: info.expiresAt,
                  reusedRoom: Boolean(info.reusedRoom),
                  identity: info.identity,
                });
                callbacksRef.current.onCallReady?.({
                  roomName: info.roomName,
                  expectedOtherIdentity: info.expectedOtherIdentity ?? null,
                  reusedRoom: Boolean(info.reusedRoom),
                });
              })
              .catch(() => {
                if (joinAbortRef.current === joinController) joinAbortRef.current = null;
                if (joinController.signal.aborted || genRef.current !== generation) return;
                joinFetchedRef.current = false;
              });
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setError((current) => current ?? "Connection check failed — retrying.");
        }
      } finally {
        if (pollAbortRef.current === controller) pollAbortRef.current = null;
      }
    }, POLL_MS);
  }, [stopPolling, fetchJoin, clearBrief]);

  const requestCall = useCallback(async (options?: { withoutBrief?: boolean }) => {
    if (busy || (briefDrafting && !options?.withoutBrief)) return;
    if (options?.withoutBrief) clearBrief();
    setBusy(true);
    setError(null);
    try {
      const includeBrief = !options?.withoutBrief
        && briefShare
        && Boolean(liveSessionId && syncToken);
      const res = await fetch("/api/live/call-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareId,
          liveSessionId: liveSessionId || undefined,
          syncToken: syncToken || undefined,
          ...(includeBrief
            ? { liveBrief: briefDraft, briefConsent: true }
            : {}),
        }),
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
      if (includeBrief) clearBrief();
      if (data.requestId) startPolling(data.requestId);
    } catch {
      setError("Could not request a call right now");
    } finally {
      setBusy(false);
    }
  }, [shareId, liveSessionId, syncToken, startPolling, busy, briefDrafting, briefShare, briefDraft, clearBrief]);

  const ownerReusedRoomArrived = Boolean(
    ownerArrived && join?.reusedRoom && twinRoom && twinRoomName === join.roomName);
  const panelState: PanelState =
    ownerReusedRoomArrived && (state === "accepted" || state === "pending")
      ? "connecting"
      : state;

  const draftBrief = useCallback(async () => {
    if (briefDrafting || !liveSessionId || !syncToken || !getBriefDialogue) return;
    const sessionId = liveSessionId;
    const generation = ++briefGenRef.current;
    const controller = new AbortController();
    briefAbortRef.current?.abort();
    briefAbortRef.current = controller;
    setBriefDrafting(true);
    setBriefError(null);
    setBriefShare(false);
    try {
      const messages = getBriefDialogue();
      const res = await fetch("/api/live/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          shareId,
          sessionId,
          syncToken,
          consent: true,
          messages,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { brief?: LiveCallBrief; error?: string };
      if (controller.signal.aborted
        || briefGenRef.current !== generation
        || liveSessionRef.current !== sessionId) return;
      if (!res.ok || !data.brief) {
        setBriefError("Draft unavailable. You can write a brief or request without one.");
        return;
      }
      setBriefDraft(data.brief);
      setBriefShare(false);
    } catch {
      if (controller.signal.aborted
        || briefGenRef.current !== generation
        || liveSessionRef.current !== sessionId) return;
      setBriefError("Draft unavailable. You can write a brief or request without one.");
    } finally {
      if (briefAbortRef.current === controller) briefAbortRef.current = null;
      if (briefGenRef.current === generation && liveSessionRef.current === sessionId) {
        setBriefDrafting(false);
      }
    }
  }, [briefDrafting, liveSessionId, syncToken, getBriefDialogue, shareId]);

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
    genRef.current += 1;
    stopPolling();
    joinAbortRef.current?.abort();
    joinAbortRef.current = null;
    setJoin(null);
    setState("cancelled");
    clearBrief();
  }, [stopPolling, clearBrief]);

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

  if (!enabled && !requestId && panelState === "idle") return null;

  if ((panelState === "connecting" || panelState === "in_call" || (panelState === "accepted" && join)) && join) {
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
            genRef.current += 1;
            setState("ended");
            setJoin(null);
            clearBrief();
            callbacksRef.current.onCallEnded?.();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      {panelState === "idle" && accepting && !briefOpen && (
        <>
          <button
            onClick={() => void requestCall({ withoutBrief: true })}
            disabled={busy}
            className="btn-press rounded-xl border border-ink/15 bg-white/70 text-ink px-5 py-2.5 text-body-sm font-medium hover:bg-white transition-colors disabled:opacity-50"
          >
            Request {senderName} now
          </button>
          {liveSessionId && syncToken && getBriefDialogue && (
            <button
              onClick={() => setBriefOpen(true)}
              className="text-body-xs text-ink-faint hover:text-ink transition-colors underline"
            >
              Request with a brief
            </button>
          )}
        </>
      )}
      {panelState === "idle" && accepting && briefOpen && (
        <div className="w-full rounded-xl border border-ink/10 bg-white/80 p-4 space-y-3 text-left">
          <p className="text-body-xs text-ink-muted leading-relaxed">
            Optional: draft a brief for {senderName}. If you choose Draft brief, your
            recent conversation is sent to our AI service to create a summary. Only the
            brief you review and choose to share is saved with your call request. Leave
            contact details and anything sensitive out of these fields.
          </p>
          {getBriefDialogue && (
            <button
              onClick={draftBrief}
              disabled={briefDrafting}
              className="btn-press rounded-lg border border-ink/15 text-ink px-3 py-1.5 text-body-xs font-medium hover:bg-white transition-colors disabled:opacity-50"
            >
              {briefDrafting ? "Drafting…" : "Draft brief"}
            </button>
          )}
          {briefError && <p className="text-body-xs text-warm">{briefError}</p>}
          {([
            ["goal", "What you want"],
            ["discussed", "What the AI explained"],
            ["openQuestions", "Still unresolved"],
            ["reason", "Why you want to speak"],
          ] as const).map(([field, label]) => (
            <label key={field} className="block">
              <span className="text-body-xs text-ink-muted">{label}</span>
              <textarea
                value={briefDraft[field]}
                maxLength={LIVE_CALL_BRIEF_FIELD_LIMIT}
                rows={2}
                disabled={briefDrafting}
                onChange={(e) => {
                  setBriefDraft((d) => ({ ...d, [field]: e.target.value }));
                  setBriefShare(false);
                }}
                className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-body-xs text-ink placeholder:text-ink-faint"
              />
            </label>
          ))}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={briefShare}
              disabled={briefDrafting}
              onChange={(e) => setBriefShare(e.target.checked)}
              className="rounded border-ink/20"
            />
            <span className="text-body-xs text-ink-muted">Share this brief with {senderName}</span>
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void requestCall()}
              disabled={busy || briefDrafting}
              className="btn-press rounded-xl bg-ink text-cream px-4 py-2 text-body-xs font-medium disabled:opacity-50"
            >
              Request call
            </button>
            <button
              onClick={() => void requestCall({ withoutBrief: true })}
              disabled={busy}
              className="text-body-xs text-ink-faint hover:text-ink transition-colors underline disabled:opacity-50"
            >
              Request without a brief
            </button>
          </div>
        </div>
      )}
      {panelState === "idle" && !accepting && (
        <p className="text-body-xs text-ink-faint">
          {availabilityError
            ? "Live call availability can't be confirmed right now"
            : `${senderName} isn't taking live calls right now`}
        </p>
      )}
      {panelState === "pending" && (
        <>
          <p role="status" aria-live="polite" className="text-body-sm text-ink-muted">
            Waiting for {senderName} to respond…
          </p>
          <button onClick={cancel} className="text-body-xs text-ink-faint hover:text-ink transition-colors underline">
            Cancel request
          </button>
        </>
      )}
      {panelState === "accepted" && !join && (
        <p role="status" aria-live="polite" className="text-body-sm text-ink-muted">
          Request accepted — preparing call…
        </p>
      )}
      {(panelState === "declined" || panelState === "expired" || panelState === "cancelled" || panelState === "ended") && (
        <>
          <p className="text-body-xs text-ink-muted">
            {panelState === "declined"
              ? `${senderName} can't take the call right now.`
              : panelState === "expired"
                ? "The request timed out."
                : panelState === "ended"
                  ? "Call ended."
                  : "Request cancelled."}
          </p>
          {accepting && panelState !== "ended" && (
            <button
              onClick={() => {
                clearRequest();
                setState("idle");
                void requestCall({ withoutBrief: true });
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
