"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { createClient, AnamEvent, type AnamClient, type Message } from "@anam-ai/js-sdk";
import { Room, RoomEvent, Track, type Participant, type TranscriptionSegment } from "livekit-client";
import {
  LIVE_CALL_BRIEF_MESSAGE_CHAR_LIMIT,
  LIVE_CALL_BRIEF_MESSAGE_LIMIT,
  LIVE_CALL_BRIEF_TOTAL_CHAR_LIMIT,
  type BriefDialogueMessage,
} from "@/lib/live-call-brief";
import { detachUnsubscribedTrack } from "@/lib/live-room-attach";
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
import { SenderTrustBadge } from "@/components/sender-trust-badge";
import { CallRequestPanel } from "@/components/call-request-panel";
import { prepareHandoffAccess } from "@/lib/live-handoff-client";

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
  const lkRoomRef = useRef<Room | null>(null);
  const [lkTwin, setLkTwin] = useState<{ room: Room; roomName: string } | null>(null);
  const humanHandoffRef = useRef(false);
  const seenSegmentsRef = useRef<Set<string>>(new Set());
  const lkAudioContainerRef = useRef<HTMLDivElement | null>(null);
  const providerRef = useRef<"anam" | "synthesia" | null>(null);
  const startedRef = useRef(false);
  const shareIdRef = useRef<string | null>(null);
  const liveSessionIdRef = useRef<string | null>(null);
  const liveSessionSyncTokenRef = useRef<string | null>(null);
  const [liveSessionInfo, setLiveSessionInfo] = useState<{ id: string; syncToken: string } | null>(null);
  const [humanCallActive, setHumanCallActive] = useState(false);
  const [ownerArrived, setOwnerArrived] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadNonce, setLoadNonce] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const expectedOwnerIdentityRef = useRef<string | null>(null);
  const dialogueRef = useRef<BriefDialogueMessage[]>([]);
  const [audioBlocked, setAudioBlocked] = useState(false);
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
    const controller = new AbortController();
    let disposed = false;
    async function load() {
      try {
        const { id } = await params;
        try {
          await prepareHandoffAccess(id);
        } catch {
          // A failed fragment exchange doesn't decide access — the share fetch
          // is authoritative and an existing cookie may still authorize.
        }
        const res = await fetch(`/api/share/${encodeURIComponent(id)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (disposed) return;
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) {
          setLoadFailed(true);
          return;
        }
        const data = (await res.json()) as ShareRecord;
        if (disposed) return;
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
        if (!disposed && !controller.signal.aborted) setLoadFailed(true);
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    load();
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [params, loadNonce]);

  const recordSessionEnd = useCallback((reason: "manual" | "provider_closed" | "max_duration" | "unload" | "human_handoff") => {
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

  const pushDialogue = useCallback((role: BriefDialogueMessage["role"], content: string) => {
    const text = content.trim().slice(0, LIVE_CALL_BRIEF_MESSAGE_CHAR_LIMIT);
    if (!text) return;
    const buffer = dialogueRef.current;
    buffer.push({ role, content: text });
    while (buffer.length > LIVE_CALL_BRIEF_MESSAGE_LIMIT) buffer.shift();
    let total = buffer.reduce((sum, m) => sum + m.content.length, 0);
    while (total > LIVE_CALL_BRIEF_TOTAL_CHAR_LIMIT && buffer.length > 1) {
      total -= buffer[0].content.length;
      buffer.shift();
    }
  }, []);

  const getBriefDialogue = useCallback(() => dialogueRef.current.map((m) => ({ ...m })), []);

  // Turn counters are derived from the full message history each time, so
  // repeated events stay idempotent.
  const handleMessageHistory = useCallback((messages: Message[]) => {
    const metrics = metricsRef.current;
    let userTurns = 0;
    let agentTurns = 0;
    dialogueRef.current = [];
    for (const message of messages) {
      if (message.role === "user") {
        userTurns += 1;
        pushDialogue("user", message.content);
        for (const topic of classifyQuestionTopics(message.content)) {
          metrics.topics.add(topic);
        }
      } else if (message.role === "persona") {
        agentTurns += 1;
        pushDialogue("assistant", message.content);
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
  }, [pushDialogue]);

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

  const endSession = useCallback((reason: "manual" | "provider_closed" | "max_duration" | "unload" | "human_handoff" = "manual") => {
    clearMaxDurationTimer();
    clearHeartbeatTimer();
    recordSessionEnd(reason);
    dialogueRef.current = [];
    if (reason === "human_handoff") {
      humanHandoffRef.current = true;
      setLiveSessionInfo(null);
      setLive(false);
      return;
    }
    setLiveSessionInfo(null);

    if (lkRoomRef.current) {
      const room = lkRoomRef.current;
      try {
        room.localParticipant.getTrackPublications().forEach((publication) => {
          publication.track?.stop();
        });
        room.disconnect();
      } catch {
        // best-effort cleanup
      } finally {
        lkRoomRef.current = null;
        setLkTwin(null);
        providerRef.current = null;
        startedRef.current = false;
        setLive(false);
        setStatus("Click below to start the live conversation");
        setLiveSessionInfo(null);
      }
    }

    if (clientRef.current) {
      try {
        clientRef.current.removeListener(AnamEvent.MESSAGE_HISTORY_UPDATED, handleMessageHistory);
        clientRef.current.stopStreaming?.();
        (clientRef.current as { disconnect?: () => void }).disconnect?.();
      } catch {
      } finally {
        clientRef.current = null;
        startedRef.current = false;
        setLive(false);
        setStatus("Click below to start the live conversation");
      }
    }
  }, [clearMaxDurationTimer, clearHeartbeatTimer, recordSessionEnd, handleMessageHistory]);

  // If the live provider is missing/misconfigured or we fail to connect after
  // a couple of retries, fall back to the recorded video share page automatically.
  useEffect(() => {
    if (!share?.id || errorReason === "mic") return;
    if (errorReason === "provider" || (errorReason === "connection" && retryCount >= 2)) {
      if (share.videoUrl || share.videoId) {
        window.location.href = `/v/${share.id}`;
      }
    }
  }, [share, errorReason, retryCount]);

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

  const toggleTwinMic = useCallback(async () => {
    if (micBusy) return;
    setMicBusy(true);
    setMicError(null);
    try {
      if (providerRef.current === "synthesia" && lkRoomRef.current) {
        await lkRoomRef.current.localParticipant.setMicrophoneEnabled(micMuted);
        setMicMuted(!lkRoomRef.current.localParticipant.isMicrophoneEnabled);
      } else if (providerRef.current === "anam" && clientRef.current) {
        const state = micMuted
          ? clientRef.current.unmuteInputAudio()
          : clientRef.current.muteInputAudio();
        setMicMuted(state.isMuted);
      }
    } catch {
      setMicError("Microphone could not be changed. Try again.");
    } finally {
      setMicBusy(false);
    }
  }, [micMuted, micBusy]);

  async function startSession() {
    if (startedRef.current) return;
    const id = (await params).id;
    shareIdRef.current = id;
    liveSessionIdRef.current = null;
    liveSessionSyncTokenRef.current = null;
    sessionSyncedRef.current = false;
    humanHandoffRef.current = false;
    seenSegmentsRef.current.clear();
    dialogueRef.current = [];
    setOwnerArrived(false);
    setMicMuted(false);
    setMicBusy(false);
    setMicError(null);
    expectedOwnerIdentityRef.current = null;
    setLkTwin(null);
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
    setStatus("Preparing conversation…");
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

      const data = (await res.json()) as {
        provider?: "anam" | "synthesia";
        sessionToken?: string;
        serverUrl?: string;
        participantToken?: string;
        roomName?: string;
        sessionId: string;
        syncToken: string;
      };
      liveSessionIdRef.current = data.sessionId;
      liveSessionSyncTokenRef.current = data.syncToken;
      setLiveSessionInfo({ id: data.sessionId, syncToken: data.syncToken });

      if (data.provider === "synthesia" && data.serverUrl && data.participantToken) {
        providerRef.current = "synthesia";
        const room = new Room({ adaptiveStream: true, dynacast: true });
        lkRoomRef.current = room;

        const syncOwnerPresence = () => {
          const expected = expectedOwnerIdentityRef.current;
          if (!expected) return;
          for (const participant of room.remoteParticipants.values()) {
            if (participant.identity === expected) {
              setOwnerArrived(true);
              return;
            }
          }
        };
        room.on(RoomEvent.ParticipantConnected, syncOwnerPresence);
        room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
          const videoEl = videoRef.current;
          if (track.kind === "video" && videoEl && participant.identity === "synthesia-avatar-agent") {
            track.attach(videoEl);
          } else if (track.kind === "audio") {
            const element = track.attach();
            element.autoplay = true;
            lkAudioContainerRef.current?.appendChild(element);
          }
        });
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          detachUnsubscribedTrack(track, videoRef.current);
        });
        room.on(RoomEvent.TranscriptionReceived, (segments: TranscriptionSegment[], participant?: Participant) => {
          if (humanHandoffRef.current) return;
          const metrics = metricsRef.current;
          const isRecipient = participant?.identity?.startsWith("guest-") || participant === room.localParticipant;
          for (const segment of segments) {
            if (!segment.final || seenSegmentsRef.current.has(segment.id)) continue;
            seenSegmentsRef.current.add(segment.id);
            if (isRecipient) {
              metrics.userTurns += 1;
              pushDialogue("user", segment.text);
              for (const topic of classifyQuestionTopics(segment.text)) {
                metrics.topics.add(topic);
              }
              if (!metrics.firstUserTurnAt) {
                metrics.firstUserTurnAt = new Date().toISOString();
                metrics.lastEvent = "first_user_turn";
              } else {
                metrics.lastEvent = "conversation";
              }
            } else {
              metrics.agentTurns += 1;
              pushDialogue("assistant", segment.text);
            }
          }
        });
        room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
          setAudioBlocked(!room.canPlaybackAudio);
        });
        room.on(RoomEvent.LocalTrackPublished, (publication) => {
          if (publication.source === Track.Source.Microphone) setMicMuted(false);
        });
        room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
          if (publication.source === Track.Source.Microphone) setMicMuted(true);
        });
        room.on(RoomEvent.Disconnected, () => {
          if (humanHandoffRef.current) {
            lkRoomRef.current = null;
            setLkTwin(null);
            providerRef.current = null;
            startedRef.current = false;
            return;
          }
          clearMaxDurationTimer();
          clearHeartbeatTimer();
          recordSessionEnd("provider_closed");
          dialogueRef.current = [];
          lkRoomRef.current = null;
          setLkTwin(null);
          providerRef.current = null;
          startedRef.current = false;
          setStatus("Session ended");
          setLive(false);
          setLiveSessionInfo(null);
        });

        await room.connect(data.serverUrl, data.participantToken, { autoSubscribe: true });
        await room.localParticipant.setMicrophoneEnabled(true);
        setAudioBlocked(!room.canPlaybackAudio);
        setLkTwin({ room, roomName: data.roomName || `nuncio-live-${data.sessionId}` });
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
        startedRef.current = true;
        return;
      }

      const client = createClient(data.sessionToken as string);
      providerRef.current = "anam";
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
        dialogueRef.current = [];
        clientRef.current = null;
        startedRef.current = false;
        setStatus("Session ended");
        setLive(false);
        setLiveSessionInfo(null);
      });

      client.addListener(AnamEvent.MESSAGE_HISTORY_UPDATED, handleMessageHistory);

      await client.streamToVideoElement("anam-video");
      startedRef.current = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start live session";
      clearMaxDurationTimer();
      clearHeartbeatTimer();
      sessionStartedAtRef.current = null;
      dialogueRef.current = [];
      liveSessionIdRef.current = null;
      liveSessionSyncTokenRef.current = null;
      setLiveSessionInfo(null);
      sessionSyncedRef.current = false;
      if (clientRef.current) {
        try {
          clientRef.current.removeListener(AnamEvent.MESSAGE_HISTORY_UPDATED, handleMessageHistory);
          clientRef.current.stopStreaming?.();
          (clientRef.current as { disconnect?: () => void }).disconnect?.();
        } catch {
        }
        clientRef.current = null;
      }
      // best-effort cleanup after a failed start
      if (lkRoomRef.current) {
        try {
          lkRoomRef.current.localParticipant.getTrackPublications().forEach((publication) => {
            publication.track?.stop();
          });
          lkRoomRef.current.disconnect();
        } catch {
        }
        lkRoomRef.current = null;
        setLkTwin(null);
        providerRef.current = null;
      }
      trackLiveSessionFailed({ shareId: id, reason: err instanceof Error ? err.name : "unknown" });
      const newRetryCount = retryCount + 1;
      setRetryCount(newRetryCount);
      // Classify the error for better messaging
      const lowerMessage = message.toLowerCase();
      const isProviderError = lowerMessage.includes("not configured") || lowerMessage.includes("configured") || lowerMessage.includes("token") || lowerMessage.includes("auth") || lowerMessage.includes("unavailable");
      setErrorReason(isProviderError ? "provider" : "connection");
      setError(isProviderError
        ? "The conversation could not be started. Please try again."
        : "Connection failed — check your network and try again.");
      setStatus(isProviderError ? "AI representative not configured" : "Click below to try again");
      startedRef.current = false;
    } finally {
      setStarting(false);
    }
  }

  if (loadFailed && !share) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-4">
          <Link href="/" className="font-display text-lg tracking-tight text-ink">
            nuncio
          </Link>
          <h1 className="font-display text-4xl tracking-tight">Invitation unavailable</h1>
          <p className="text-sm text-ink-muted leading-relaxed">
            The page couldn&apos;t be loaded — check your connection and try again.
          </p>
          <button
            onClick={() => {
              setLoadFailed(false);
              setLoading(true);
              setLoadNonce((n) => n + 1);
            }}
            className="btn-press inline-flex rounded-xl bg-ink text-cream px-5 py-3 text-sm font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
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
          <h1 className="font-display text-4xl tracking-tight">Invitation unavailable</h1>
          <p className="text-sm text-ink-muted leading-relaxed">
            This live conversation link isn&apos;t available.
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
  const handoffMeta = (share as ShareRecord & {
    handoff?: {
      recommendedNextStep: "call" | "twin" | "book" | null;
      expiresAt: string;
      options?: { twin?: boolean; callRequestsEnabled?: boolean; acceptingCalls?: boolean; bookingUrl?: string | null };
    };
  }).handoff;

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
        <div className="w-full max-w-[960px]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mb-8 text-center"
          >
            <p className="text-label-sm uppercase tracking-widest text-ink-faint font-medium mb-3">
              {handoffMeta ? "A personal invitation" : "Conversation link"}
            </p>
            {share.recipientName && (
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="w-7 h-7 rounded-full bg-cream-dark flex items-center justify-center text-label-sm font-medium text-ink-muted">
                  {recipient.slice(0, 1).toUpperCase()}
                </span>
                <span className="text-ink-faint text-sm">·</span>
                <span className="w-7 h-7 rounded-full bg-ink flex items-center justify-center text-label-sm font-medium text-cream">
                  {sender.slice(0, 1).toUpperCase()}
                </span>
                <p className="text-sm text-ink-faint ml-1">Hey {recipient}</p>
              </div>
            )}
            <h1 className="font-display text-4xl md:text-5xl tracking-tight leading-[0.9] mb-3">
              A conversation with {sender}
            </h1>
            {handoffMeta && (
              <p className="text-body-sm text-ink-muted mb-2">
                Continue the conversation started by {sender}
              </p>
            )}
            <div className="flex flex-col items-center gap-2">
              <SenderTrustBadge
                senderName={share.senderName}
                recipientName={share.recipientName}
                mode={share.mode}
                deliveryMode={share.deliveryMode}
                playbookConfigured={share.liveReadiness?.playbookConfigured ?? false}
              />
            </div>
          </motion.div>

          {humanCallActive && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 rounded-2xl border border-ink/20 bg-white/80 px-5 py-3.5 flex flex-col items-center gap-1"
              role="status"
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full border border-ink" aria-hidden />
                <span className="text-body-sm font-medium text-ink">Human call room</span>
              </span>
              <span className="text-body-xs text-ink-faint">Presence and microphone status appear below.</span>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 mb-0"
          >
            <p className="text-label-sm uppercase tracking-widest text-ink-faint font-medium text-center mb-3">
              Choose how to continue
            </p>
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${bookingUrl ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
              <div className="rounded-2xl border border-cream-dark bg-white/70 p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${live ? "bg-accent" : "bg-accent/40"}`} aria-hidden />
                  <p className="text-body-xs font-medium text-ink">Ask the AI representative</p>
                </div>
                <p className="text-body-xs text-ink-muted mb-3">Questions first, without scheduling</p>
                <div className="mt-auto flex flex-wrap items-center gap-2">
              {humanCallActive ? (
                <p className="text-body-xs text-ink-faint">Human call controls are below.</p>
              ) : !live ? (
                handoffMeta && handoffMeta.options?.twin === false ? (
                  <p className="text-body-sm text-ink-muted">Not configured for this link</p>
                ) : (
                <button
                  onClick={startSession}
                  disabled={starting}
                  aria-label={starting ? "Starting live conversation" : `Talk to ${sender}'s AI representative`}
                  className="btn-press rounded-xl bg-accent text-white px-6 py-3 text-body-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-h-[44px]"
                >
                  {starting ? (
                    <>
                      <LottieIcon name="spinner-light" className="w-4 h-4" />
                      Starting...
                    </>
                  ) : errorReason === "provider" ? (
                    <>
                      Try again
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 12.5a4.5 4.5 0 004.5-4.5M8 12.5a4.5 4.5 0 01-4.5-4.5M8 12.5V14m0-13v1.5" />
                      </svg>
                      Talk to {sender}&apos;s AI
                    </>
                  )}
                </button>
                )
              ) : (
                <>
                <button
                  onClick={toggleTwinMic}
                  disabled={micBusy}
                  aria-label={micMuted ? "Unmute microphone" : "Mute microphone"}
                  className="btn-press rounded-xl border border-ink/15 bg-white/70 text-ink px-4 py-3 text-body-sm font-medium hover:bg-white transition-colors flex items-center gap-2 disabled:opacity-50 min-h-[44px]"
                >
                  {micMuted ? "Unmute" : "Mute"}
                </button>
                <button
                  onClick={() => endSession("manual")}
                  aria-label="End live conversation"
                  className="btn-press rounded-xl bg-warm text-white px-6 py-3 text-body-sm font-medium hover:bg-warm/90 transition-colors flex items-center gap-2 min-h-[44px]"
                >
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="10" height="10" rx="2" />
                  </svg>
                  End conversation
                </button>
                </>
              )}
                </div>
              </div>

              <div className="rounded-2xl border border-cream-dark bg-white/70 p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-warm shrink-0" aria-hidden />
                  <p className="text-body-xs font-medium text-ink break-words">Request {sender}</p>
                </div>
                <p className="text-body-xs text-ink-muted mb-1">
                  When they&apos;re taking calls, send a request. They decide whether to join.
                </p>
                <div className="mt-auto">
            <CallRequestPanel
              shareId={share.id}
              liveSessionId={liveSessionInfo?.id}
              syncToken={liveSessionInfo?.syncToken}
              senderName={sender}
              twinRoom={lkTwin?.room ?? null}
              twinRoomName={lkTwin?.roomName ?? null}
              ownerArrived={ownerArrived}
              getBriefDialogue={getBriefDialogue}
              onCallReady={({ roomName, expectedOtherIdentity, reusedRoom }) => {
                const room = lkRoomRef.current;
                if (reusedRoom && room && room.name === roomName) {
                  expectedOwnerIdentityRef.current = expectedOtherIdentity;
                } else {
                  expectedOwnerIdentityRef.current = null;
                }
                const expected = expectedOwnerIdentityRef.current;
                if (expected && room) {
                  for (const participant of room.remoteParticipants.values()) {
                    if (participant.identity === expected) {
                      setOwnerArrived(true);
                      break;
                    }
                  }
                }
              }}
              onOwnerPresent={() => {
                setHumanCallActive(true);
                endSession("human_handoff");
              }}
              onHumanRoomConnected={() => {
                setHumanCallActive(true);
                if (providerRef.current) endSession("manual");
              }}
              onCallEnded={() => {
                expectedOwnerIdentityRef.current = null;
                setOwnerArrived(false);
                setHumanCallActive(false);
                humanHandoffRef.current = false;
                if (lkRoomRef.current) endSession("manual");
              }}
            />
                </div>
              </div>

              {bookingUrl ? (
              <div className="rounded-2xl border border-cream-dark bg-white/70 p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-ink shrink-0" aria-hidden />
                  <p className="text-body-xs font-medium text-ink">Choose a time</p>
                </div>
                <p className="text-body-xs text-ink-muted mb-3">Opens {sender}&apos;s scheduling link</p>
                <div className="mt-auto flex justify-start">
                <button
                  onClick={() => {
                    if (share.mode === "reconnect") {
                      trackReconnectCatchupClicked({ shareId: share.id, surface: "live_page" });
                    }
                    handleBookingClick();
                  }}
                  aria-label={share.mode === "reconnect" ? `Let's catch up with ${sender}` : `Book time with ${sender}`}
                  className="btn-press rounded-xl border border-ink/15 bg-white/70 text-ink px-5 py-2.5 text-body-sm font-medium hover:bg-white transition-colors flex items-center gap-2 min-h-[44px]"
                >
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="3" width="12" height="11" rx="2" />
                    <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
                  </svg>
                  {share.mode === "reconnect" ? `Let's catch up with ${sender}` : `Book time with ${sender}`}
                </button>
                </div>
              </div>
              ) : null}
            </div>
            {micError && (
              <p role="alert" className="text-body-xs text-warm text-center mt-3">{micError}</p>
            )}
          </motion.div>

          <div className={(starting || live || error) && !humanCallActive ? "relative mt-6" : "hidden"}>
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="absolute -inset-3 rounded-3xl bg-cream-dark/60 -z-10 transform rotate-1" />
            <div className="absolute -inset-1.5 rounded-3xl bg-cream-dark -z-5 transform -rotate-0.5" />

            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-ink shadow-2xl shadow-ink/20 ring-1 ring-ink/5 flex items-center justify-center relative">
              {/* The video element mounts before any SDK stream — the Anam and
                  LiveKit attach calls need a stable target. */}
              <video
                id="anam-video"
                ref={videoRef}
                autoPlay
                playsInline
                className={`absolute inset-0 w-full h-full object-cover ${live ? "" : "invisible"}`}
              />
              <div ref={lkAudioContainerRef} aria-hidden className="hidden" />
              {!live && (
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
                  {error && errorReason !== "mic" && (retryCount >= 2 || errorReason === "provider") && (share.videoUrl || share.videoId) && (
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
          </div>

          {(live || starting || humanCallActive) && (
            <p className="mt-3 text-center text-body-xs text-ink-faint">
              No camera needed. Microphone is active only during the conversation.
            </p>
          )}

          {(audioBlocked && (live || humanCallActive)) && (
            <div className="mt-3 flex justify-center">
              <button
                onClick={() => {
                  void lkRoomRef.current?.startAudio().finally(() => {
                    setAudioBlocked(!(lkRoomRef.current?.canPlaybackAudio ?? true));
                  });
                }}
                className="btn-press rounded-xl border border-ink/15 bg-white/70 text-ink px-4 py-2 text-body-xs font-medium hover:bg-white transition-colors"
              >
                Enable audio
              </button>
            </div>
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
                ? `This is an AI representative speaking for ${sender}. It can answer questions about the message — the card was built around a real memory they shared and approved before it was sent. You'll need to allow microphone access to talk. Your mic is only active while the session is running.`
                : `This is an AI representative for ${sender}. It can answer questions about the reason for reaching out${bookingUrl ? ", and point you to scheduling" : ""}. You'll need to allow microphone access to talk. Your mic is only active while the session is running.`}
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
