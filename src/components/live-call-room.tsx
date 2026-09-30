"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteParticipant } from "livekit-client";

type RoomState = "idle" | "connecting" | "in_call" | "ended";

const HEARTBEAT_MS = 5_000;

/**
 * Shared owner/recipient LiveKit call surface. An owned room connects only on
 * an explicit Connect press — acceptance or token issuance is never shown as
 * "joined". "Joined" means the other participant is actually present in the
 * room right now, tracked by exact identity and cleared on departure. A
 * borrowed room (Synthesia handoff) is never connected by this component and
 * is not torn down on unmount — only an explicit End call or expiry stops the
 * borrowed mic and room. Join credentials are fetched fresh at connect time so
 * a 60s token never goes stale while the user sits on the screen.
 */
export function LiveCallRoom({
  serverUrl,
  participantToken,
  getJoinCredentials,
  role,
  otherName,
  expectedOtherIdentity,
  expiresAt,
  existingRoom,
  onConnected,
  onOtherJoined,
  onEnded,
  onEndRequested,
  onCleanupPending,
  onPresenceHeartbeat,
}: {
  serverUrl: string;
  participantToken?: string;
  getJoinCredentials?: () => Promise<{ serverUrl: string; participantToken: string }>;
  role: "owner" | "recipient";
  otherName: string;
  expectedOtherIdentity?: string | null;
  expiresAt?: string;
  existingRoom?: Room | null;
  onConnected?: () => void;
  onOtherJoined?: () => void;
  onEnded?: () => void;
  onEndRequested?: () => Promise<boolean | void>;
  onCleanupPending?: () => void;
  onPresenceHeartbeat?: () => void;
}) {
  const borrowed = Boolean(existingRoom);
  const [roomState, setRoomState] = useState<RoomState>(borrowed ? "in_call" : "idle");
  const [otherPresent, setOtherPresent] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [micEnabled, setMicEnabled] = useState(
    () => Boolean(existingRoom?.localParticipant.isMicrophoneEnabled),
  );
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [cleanupWarning, setCleanupWarning] = useState(false);
  const roomRef = useRef<Room | null>(existingRoom ?? null);
  const detachRef = useRef<(() => void) | null>(null);
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const attachedRef = useRef<Map<Track, Set<HTMLMediaElement>>>(new Map());
  const connectGenRef = useRef(0);
  const otherJoinedNotifiedRef = useRef(false);
  const endedRef = useRef(false);

  const callbacksRef = useRef({ onConnected, onOtherJoined, onEnded, onCleanupPending, onPresenceHeartbeat });
  useEffect(() => {
    callbacksRef.current = { onConnected, onOtherJoined, onEnded, onCleanupPending, onPresenceHeartbeat };
  }, [onConnected, onOtherJoined, onEnded, onCleanupPending, onPresenceHeartbeat]);

  const detachAudioTrack = useCallback((track: Track) => {
    const elements = attachedRef.current.get(track);
    if (!elements) return;
    for (const element of elements) {
      if (!borrowed) track.detach(element);
      element.remove();
    }
    attachedRef.current.delete(track);
  }, [borrowed]);

  const attachAudioTrack = useCallback((track: Track) => {
    if (borrowed || track.kind !== "audio" || attachedRef.current.has(track)) return;
    const element = track.attach();
    element.autoplay = true;
    attachedRef.current.set(track, new Set([element]));
    audioContainerRef.current?.appendChild(element);
  }, [borrowed]);

  const detachAllAudio = useCallback(() => {
    for (const track of Array.from(attachedRef.current.keys())) detachAudioTrack(track);
  }, [detachAudioTrack]);

  const teardownLocal = useCallback((stopTransport: boolean) => {
    endedRef.current = true;
    detachRef.current?.();
    detachRef.current = null;
    const room = roomRef.current;
    roomRef.current = null;
    detachAllAudio();
    if (room && (stopTransport || !borrowed)) {
      room.localParticipant.getTrackPublications().forEach((publication) => {
        publication.track?.stop();
      });
      room.disconnect();
    }
    setRoomState("ended");
    setOtherPresent(false);
  }, [borrowed, detachAllAudio]);

  const matchesOther = useCallback((participant: RemoteParticipant) => {
    if (expectedOtherIdentity) return participant.identity === expectedOtherIdentity;
    return participant.identity.startsWith(role === "owner" ? "recipient-" : "owner-")
      || participant.identity.startsWith("guest-");
  }, [expectedOtherIdentity, role]);

  const finish = useCallback((stopTransport: boolean) => {
    if (endedRef.current) return;
    teardownLocal(stopTransport);
    callbacksRef.current.onEnded?.();
  }, [teardownLocal]);

  const attachRoom = useCallback((room: Room) => {
    const syncPresence = () => {
      const present = Array.from(room.remoteParticipants.values()).some(matchesOther);
      setOtherPresent(present);
      if (present && !otherJoinedNotifiedRef.current) {
        otherJoinedNotifiedRef.current = true;
        callbacksRef.current.onOtherJoined?.();
      }
      callbacksRef.current.onPresenceHeartbeat?.();
    };
    const onTrackSubscribed = (track: Track) => attachAudioTrack(track);
    const onTrackUnsubscribed = (track: Track) => detachAudioTrack(track);
    const onDisconnected = () => finish(false);
    const onPlaybackChanged = () => setAudioBlocked(!room.canPlaybackAudio);
    room.on(RoomEvent.ParticipantConnected, syncPresence);
    room.on(RoomEvent.ParticipantDisconnected, syncPresence);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.AudioPlaybackStatusChanged, onPlaybackChanged);
    syncPresence();
    setAudioBlocked(!room.canPlaybackAudio);
    const detach = () => {
      room.off(RoomEvent.ParticipantConnected, syncPresence);
      room.off(RoomEvent.ParticipantDisconnected, syncPresence);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.AudioPlaybackStatusChanged, onPlaybackChanged);
    };
    detachRef.current = detach;
    return detach;
  }, [attachAudioTrack, detachAudioTrack, finish, matchesOther]);

  useEffect(() => {
    if (!existingRoom) return;
    roomRef.current = existingRoom;
    const detach = attachRoom(existingRoom);
    callbacksRef.current.onConnected?.();
    return () => {
      detach();
      if (detachRef.current === detach) detachRef.current = null;
    };
  }, [existingRoom, attachRoom]);

  useEffect(() => {
    if (roomState !== "in_call") return;
    const timer = setInterval(() => callbacksRef.current.onPresenceHeartbeat?.(), HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [roomState]);

  useEffect(() => {
    if (!expiresAt || roomState === "ended") return;
    const deadline = new Date(expiresAt).getTime() - Date.now();
    if (deadline <= 0) {
      finish(true);
      return;
    }
    const timer = setTimeout(() => finish(true), deadline);
    return () => clearTimeout(timer);
  }, [expiresAt, roomState, finish]);

  useEffect(() => {
    endedRef.current = false;
    return () => {
      connectGenRef.current += 1;
      endedRef.current = true;
      detachRef.current?.();
      detachRef.current = null;
      detachAllAudio();
      if (borrowed) return;
      const room = roomRef.current;
      roomRef.current = null;
      if (room) {
        room.localParticipant.getTrackPublications().forEach((publication) => {
          publication.track?.stop();
        });
        room.disconnect();
      }
    };
  }, [borrowed, detachAllAudio]);

  const connect = useCallback(async () => {
    if (roomRef.current || borrowed || roomState === "connecting" || endedRef.current) return;
    const generation = ++connectGenRef.current;
    const isStale = (room?: Room | null) =>
      generation !== connectGenRef.current
      || endedRef.current
      || (room ? roomRef.current !== room : false);
    setError(null);
    setRoomState("connecting");
    let credentials = participantToken
      ? { serverUrl, participantToken }
      : null;
    try {
      credentials = await getJoinCredentials?.() ?? credentials;
    } catch {
      if (isStale()) return;
      setRoomState("idle");
      setError("This call could not be joined — the request may have expired. Start a new request below.");
      return;
    }
    if (isStale()) return;
    if (!credentials) {
      setRoomState("idle");
      setError("Could not connect to the call — check your connection and try again.");
      return;
    }
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    const detach = attachRoom(room);
    try {
      await room.connect(credentials.serverUrl, credentials.participantToken, { autoSubscribe: true });
    } catch {
      if (isStale(room)) return;
      detach();
      room.disconnect();
      roomRef.current = null;
      setRoomState("idle");
      setError("Could not connect to the call — check your connection and try again.");
      return;
    }
    if (isStale(room)) {
      detach();
      room.disconnect();
      return;
    }
    room.remoteParticipants.forEach((participant) => {
      participant.getTrackPublications().forEach((publication) => {
        const track = publication.track;
        if (track) attachAudioTrack(track);
      });
    });
    setRoomState("in_call");
    callbacksRef.current.onConnected?.();
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      if (isStale(room)) {
        room.localParticipant.getTrackPublications().forEach((publication) => {
          publication.track?.stop();
        });
        room.disconnect();
        return;
      }
      setMicEnabled(true);
    } catch {
      if (isStale(room)) return;
      setMicEnabled(false);
      setError("Microphone access is blocked. You can still listen; allow access or retry to speak.");
    }
  }, [attachAudioTrack, attachRoom, borrowed, getJoinCredentials, participantToken, roomState, serverUrl]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room || roomState !== "in_call") return;
    try {
      const next = !micEnabled;
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicEnabled(next);
      setError(null);
    } catch {
      setError("Microphone access is blocked. You can still listen; allow access or retry to speak.");
    }
  }, [micEnabled, roomState]);

  const enableAudio = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.startAudio();
      setAudioBlocked(!room.canPlaybackAudio);
    } catch {
      setAudioBlocked(true);
    }
  }, []);

  const endCall = useCallback(async () => {
    if (ending || endedRef.current) return;
    setEnding(true);
    setCleanupWarning(false);
    connectGenRef.current += 1;
    teardownLocal(true);
    let outcome: boolean | void = true;
    try {
      outcome = await onEndRequested?.();
    } catch {
      outcome = false;
    }
    if (outcome === false) {
      setCleanupWarning(true);
      setError("Call closed locally; server cleanup could not be confirmed.");
      callbacksRef.current.onCleanupPending?.();
    }
    callbacksRef.current.onEnded?.();
    setEnding(false);
  }, [ending, onEndRequested, teardownLocal]);

  if (roomState === "ended") {
    return (
      <div className="rounded-2xl border border-cream-dark bg-white/70 p-4 text-center space-y-2">
        <p className="text-body-sm text-ink-muted">Call ended.</p>
        {cleanupWarning && (
          <p className="text-body-xs text-warm">Call closed locally; server cleanup could not be confirmed.</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-cream-dark bg-white/70 p-4 space-y-3">
      <div ref={audioContainerRef} aria-hidden className="hidden" />
      <p role="status" aria-live="polite" className="text-body-sm text-ink-muted text-center">
        {roomState === "connecting"
          ? "Connecting…"
          : roomState === "idle"
            ? "Ready to connect"
            : otherPresent
              ? `${otherName} joined`
              : `Waiting for ${otherName} to join…`}
      </p>
      {error && <p className="text-body-xs text-warm text-center">{error}</p>}
      {audioBlocked && roomState === "in_call" && (
        <p className="text-body-xs text-ink-faint text-center">
          Audio is blocked by the browser —{" "}
          <button onClick={enableAudio} className="underline text-accent hover:text-accent/80 transition-colors">
            enable audio
          </button>
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {roomState === "idle" && !borrowed && (
          <button
            onClick={connect}
            className="btn-press rounded-xl bg-accent text-white px-5 py-2.5 text-body-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Connect to call
          </button>
        )}
        {roomState === "connecting" && (
          <button
            disabled
            className="rounded-xl bg-accent/60 text-white px-5 py-2.5 text-body-sm font-medium"
          >
            Connecting…
          </button>
        )}
        {roomState === "in_call" && (
          <>
            <button
              onClick={toggleMic}
              className="btn-press rounded-xl border border-ink/15 text-ink px-4 py-2 text-body-xs font-medium hover:bg-white transition-colors"
            >
              {micEnabled ? "Mute microphone" : "Unmute microphone"}
            </button>
            <button
              onClick={endCall}
              disabled={ending}
              className="btn-press rounded-xl bg-warm text-white px-4 py-2 text-body-xs font-medium hover:bg-warm/90 transition-colors disabled:opacity-50"
            >
              End call
            </button>
          </>
        )}
      </div>
    </div>
  );
}
