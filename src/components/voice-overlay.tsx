"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Conversation } from "@elevenlabs/client";

export interface VoiceProfileResult {
  name?: string;
  company?: string;
  role?: string;
  url?: string;
  senderName?: string;
  senderBrief?: string;
  archetype?: string;
  tone?: string;
}

interface VoiceOverlayProps {
  open: boolean;
  onClose: () => void;
  onComplete: (profile: VoiceProfileResult) => void;
  /** If provided, called instead of onComplete when profile is captured. Parent can show email capture, then call onComplete. */
  onRequestSave?: (profile: VoiceProfileResult) => void;
}

type Status = "idle" | "connecting" | "listening" | "speaking" | "captured" | "error";

const FIELD_LABELS: Record<keyof VoiceProfileResult, string> = {
  name: "Recipient",
  company: "Company",
  role: "Role",
  url: "Profile URL",
  senderName: "Sender",
  senderBrief: "Brief",
  archetype: "Hook",
  tone: "Tone",
};

export function VoiceOverlay({ open, onClose, onComplete, onRequestSave }: VoiceOverlayProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [modeDisplay, setModeDisplay] = useState<string>("");
  const [transcripts, setTranscripts] = useState<{ role: "user" | "agent"; text: string }[]>([]);
  const [error, setError] = useState("");
  const [capturedProfile, setCapturedProfile] = useState<VoiceProfileResult | null>(null);
  const [saveEmail, setSaveEmail] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const conversationRef = useRef<Awaited<ReturnType<typeof Conversation.startSession>> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  // Catch SDK internal unhandled rejections (e.g. WebRTC data channel errors)
  useEffect(() => {
    function handleUnhandledRejection(e: PromiseRejectionEvent) {
      const reason = e.reason;
      if (typeof reason === "object" && reason !== null) {
        const msg = reason.message || reason.toString?.() || "Voice connection error";
        if (msg.includes("error_type") || msg.includes("DataChannel") || msg.includes("webrtc") || msg.includes("room")) {
          e.preventDefault();
          console.warn("[voice-overlay] Caught SDK error:", reason);
          setError("Voice connection interrupted. Please try again.");
          setStatus("error");
          conversationRef.current?.endSession().catch(() => {});
          conversationRef.current = null;
        }
      }
    }
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  }, []);

  function handleClose() {
    conversationRef.current?.endSession().catch(() => {});
    conversationRef.current = null;
    setStatus("idle");
    setModeDisplay("");
    setTranscripts([]);
    setError("");
    setCapturedProfile(null);
    setSaveEmail("");
    setSaveLoading(false);
    setSaveError("");
    onClose();
  }

  const startVoice = useCallback(async () => {
    setError("");
    setCapturedProfile(null);
    setSaveEmail("");
    setSaveLoading(false);
    setSaveError("");
    setStatus("connecting");
    setTranscripts([{ role: "agent", text: "Hi! I’m your nuncio agent. Tell me who you want to reach, why now, and what tone you want." }]);

    try {
      const tokenRes = await fetch("/api/studio/voice/token");
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({}));
        throw new Error(body.error || "Voice server unavailable");
      }
      const tokenData = await tokenRes.json();
      const signedUrl = tokenData.signed_url;

      if (!signedUrl) {
        throw new Error("No signed URL received from voice server");
      }

      console.log("[voice] starting session with signedUrl");
      const conversation = await Conversation.startSession({
        signedUrl,
        overrides: {
          agent: {
            firstMessage: "Hi! I’m your nuncio agent. Tell me who you want to reach, why now, and what tone you want.",
          },
        },
        onMessage: (msg) => {
          if (msg.role === "agent") {
            const text = msg.message;
            if (text.includes("[SYSTEM] PROFILE_READY:")) {
              const jsonStr = text.split("PROFILE_READY:")[1].trim();
              try {
                const profile = JSON.parse(jsonStr);
                setCapturedProfile(profile);
                setStatus("captured");
                setTranscripts((prev) => [...prev, { role: "agent", text: "Got it — I captured the brief and I’m filling the studio now." }]);
                setTimeout(() => {
                  if (onRequestSave) {
                    onRequestSave(profile);
                  } else {
                    onComplete(profile);
                  }
                }, 1000);
              } catch {
                /* ignore */
              }
              return;
            }
            setTranscripts((prev) => [...prev, { role: "agent", text }]);
          } else {
            setTranscripts((prev) => [...prev, { role: "user", text: msg.message }]);
          }
        },
        onModeChange: ({ mode }) => {
          setModeDisplay(mode);
          setStatus(mode === "speaking" ? "speaking" : "listening");
        },
        onError: (msg: unknown) => {
          const text = typeof msg === "string" ? msg : msg instanceof Error ? msg.message : JSON.stringify(msg);
          setError(text || "Voice connection error");
          setStatus("error");
        },
        onDisconnect: () => {
          setStatus((current) => {
            if (current === "captured") return "captured";
            // If we were connecting/listening/speaking, an unexpected disconnect is an error
            if (current === "connecting" || current === "listening" || current === "speaking") {
              setError("Connection closed unexpectedly. Please try again.");
              return "error";
            }
            return "idle";
          });
        },
      });

      conversationRef.current = conversation;
      setStatus("listening");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect");
      setStatus("error");
    }
  }, [onComplete]);

  const stopVoice = useCallback(() => {
    conversationRef.current?.endSession().catch(() => {});
    conversationRef.current = null;
    setStatus("idle");
    setModeDisplay("");
  }, []);

  const capturedFields = capturedProfile
    ? (Object.entries(capturedProfile) as [keyof VoiceProfileResult, string | undefined][])
        .filter(([key, value]) => Boolean(value) && key in FIELD_LABELS)
        .slice(0, 6)
    : [];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-3xl rounded-3xl border border-cream-dark bg-white shadow-[0_24px_80px_-24px_rgba(0,0,0,0.35)] overflow-hidden"
          >
            <div className="grid md:grid-cols-[0.9fr,1.1fr]">
              <div className="relative bg-gradient-to-br from-accent-soft via-white to-warm-soft p-6 flex flex-col justify-between min-h-[360px]">
                <button
                  onClick={handleClose}
                  className="absolute top-4 right-4 p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-white/50 transition-colors"
                >
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>

                <div className="space-y-3 pr-8">
                  <div className="inline-flex items-center gap-2 rounded-full border border-accent/15 bg-white/70 px-3 py-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      status === "error" ? "bg-error" :
                      status === "captured" ? "bg-success" :
                      status === "idle" ? "bg-ink-faint" :
                      "bg-accent animate-pulse"
                    }`} />
                    <span className="text-[10px] uppercase tracking-widest font-medium text-accent">
                      ElevenLabs Speech Engine
                    </span>
                  </div>
                  <h2 className="font-[family-name:var(--font-display)] text-3xl text-ink leading-tight">
                    Brief your video agent by voice.
                  </h2>
                  <p className="text-sm text-ink-muted leading-relaxed">
                    Speak naturally. Nuncio listens, asks follow-ups, extracts the campaign brief, then fills Studio automatically.
                  </p>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <div className={`relative w-32 h-32 rounded-full flex items-center justify-center ${
                    status === "speaking" ? "bg-warm-soft" :
                    status === "listening" ? "bg-success-soft" :
                    status === "captured" ? "bg-success-soft" :
                    status === "error" ? "bg-error-soft" :
                    "bg-accent-soft"
                  }`}>
                    {(status === "listening" || status === "speaking" || status === "connecting") && (
                      <>
                        <span className="absolute inset-0 rounded-full bg-accent/10 animate-ping" />
                        <span className="absolute inset-4 rounded-full bg-accent/10 animate-pulse" />
                      </>
                    )}
                    <button
                      onClick={status === "idle" || status === "error" || status === "captured" ? startVoice : stopVoice}
                      disabled={status === "connecting"}
                      className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg disabled:opacity-40 ${
                        status !== "idle" && status !== "error" && status !== "captured"
                          ? "bg-error text-white hover:bg-error/90"
                          : "bg-accent text-white hover:bg-accent/90"
                      }`}
                    >
                      {status !== "idle" && status !== "error" && status !== "captured" ? (
                        <svg viewBox="0 0 16 16" className="w-6 h-6" fill="currentColor">
                          <rect x="5" y="2" width="6" height="12" rx="1" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 16 16" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M8 2v8M5 6v4a3 3 0 006 0V6" />
                          <path d="M3 8a5 5 0 0010 0M8 13v2" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-ink">
                      {status === "idle" && "Ready when you are"}
                      {status === "connecting" && "Connecting voice session…"}
                      {status === "listening" && "Listening"}
                      {status === "speaking" && "Agent speaking"}
                      {status === "captured" && "Brief captured"}
                      {status === "error" && "Could not connect"}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {error || (modeDisplay ? `Mode: ${modeDisplay}` : "Try: “I want to reach Maya about her AI workflow post…”")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-ink-faint">Live transcript</p>
                  <p className="text-sm text-ink-muted">Your voice becomes structured context for the video.</p>
                </div>
                <div ref={scrollRef} className="h-64 overflow-y-auto space-y-2 rounded-2xl border border-cream-dark bg-cream/40 p-3">
                  {transcripts.length === 0 && (
                    <p className="text-xs text-ink-faint text-center py-20">
                      Press the mic to start a natural briefing conversation.
                    </p>
                  )}
                  {transcripts.map((t, i) => (
                    <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        t.role === "user"
                          ? "bg-accent text-white rounded-br-sm"
                          : "bg-white border border-cream-dark text-ink rounded-bl-sm"
                      }`}>
                        {t.text}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-cream-dark p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-ink">Extracted brief</p>
                    <span className="text-[10px] text-ink-faint">
                      {capturedFields.length > 0 ? `${capturedFields.length} fields` : "waiting"}
                    </span>
                  </div>
                  {capturedFields.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {capturedFields.map(([key, value]) => (
                        <div key={key} className="rounded-xl bg-success-soft/40 border border-success/10 p-2">
                          <span className="block text-[9px] uppercase tracking-widest text-ink-faint">{FIELD_LABELS[key]}</span>
                          <span className="text-xs text-ink line-clamp-2">{value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-ink-muted">
                      Once the agent has enough info, the brief appears here and Studio fills itself.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
