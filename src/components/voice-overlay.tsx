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
}

type Status = "idle" | "connecting" | "connected" | "listening" | "speaking" | "error";

export function VoiceOverlay({ open, onClose, onComplete }: VoiceOverlayProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [modeDisplay, setModeDisplay] = useState<string>("");
  const [transcripts, setTranscripts] = useState<{ role: "user" | "agent"; text: string }[]>([]);
  const [error, setError] = useState("");
  const conversationRef = useRef<Awaited<ReturnType<typeof Conversation.startSession>> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  function handleClose() {
    conversationRef.current?.endSession().catch(() => {});
    conversationRef.current = null;
    setStatus("idle");
    setModeDisplay("");
    setTranscripts([]);
    setError("");
    onClose();
  }

  const startVoice = useCallback(async () => {
    setError("");
    setStatus("connecting");
    setTranscripts([{ role: "agent", text: "Hi! I'm your nuncio agent. Who are you reaching out to?" }]);

    try {
      const tokenRes = await fetch("/api/studio/voice/token");
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({}));
        throw new Error(body.error || "Voice server unavailable");
      }

      const tokenData = await tokenRes.json();
      const conversationToken = tokenData.conversation_token || tokenData.token;

      if (!conversationToken) {
        throw new Error("No conversation token received");
      }

      const conversation = await Conversation.startSession({
        conversationToken,
        connectionType: "webrtc",
        overrides: {
          agent: {
            firstMessage: "Hi! I'm your nuncio agent. Who are you reaching out to?",
          },
        },
        onMessage: (msg) => {
          if (msg.role === "agent") {
            const text = msg.message;
            if (text.includes("[SYSTEM] PROFILE_READY:")) {
              const jsonStr = text.split("PROFILE_READY:")[1].trim();
              try {
                const profile = JSON.parse(jsonStr);
                setTranscripts((prev) => [...prev, { role: "agent", text: "Got it! Let me set that up for you." }]);
                setTimeout(() => onComplete(profile), 1000);
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
        onError: (msg) => {
          setError(msg);
          setStatus("error");
        },
        onDisconnect: () => {
          setStatus("idle");
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-24 right-6 z-50 w-80 sm:w-96"
        >
          <div className="rounded-2xl border border-cream-dark bg-white shadow-[0_8px_40px_-12px_rgba(0,0,0,0.2)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-cream-dark/50">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  status === "listening" ? "bg-success animate-pulse" :
                  status === "connecting" ? "bg-warm animate-pulse" :
                  status === "speaking" ? "bg-accent" :
                  status === "error" ? "bg-error" : "bg-ink-faint"
                }`} />
                <span className="text-xs font-medium text-ink">
                  {status === "idle" && "Voice agent"}
                  {status === "connecting" && "Connecting…"}
                  {status === "listening" && modeDisplay === "speaking" ? "Speaking" : "Listening"}
                  {status === "speaking" && "Speaking"}
                  {status === "error" && "Error"}
                </span>
              </div>
              <button
                onClick={handleClose}
                className="p-1 rounded-md text-ink-faint hover:text-ink hover:bg-cream-dark/30 transition-colors"
              >
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            <div ref={scrollRef} className="px-4 py-3 h-56 overflow-y-auto space-y-2">
              {transcripts.length === 0 && (
                <p className="text-xs text-ink-faint text-center py-8">
                  Click start to begin.
                </p>
              )}
              {transcripts.map((t, i) => (
                <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    t.role === "user"
                      ? "bg-accent text-white rounded-br-sm"
                      : "bg-cream-dark/30 text-ink rounded-bl-sm"
                  }`}>
                    {t.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-cream-dark/50 flex items-center gap-2">
              <div className="flex-1 text-[10px] text-ink-faint">
                {error && <span className="text-error">{error}</span>}
                {!error && status === "idle" && <span>Start the conversation to begin</span>}
                  {!error && status !== "idle" && <span>Speak naturally &mdash; I am listening</span>}
              </div>
              <button
                onClick={status === "idle" || status === "error" ? startVoice : stopVoice}
                disabled={status === "connecting"}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  status !== "idle" && status !== "error"
                    ? "bg-error text-white hover:bg-error/90 shadow-sm"
                    : "bg-accent text-white hover:bg-accent/90 shadow-sm"
                } disabled:opacity-40`}
              >
                {status !== "idle" && status !== "error" ? (
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
                    <rect x="5" y="2" width="6" height="12" rx="1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M8 2v8M5 6v4a3 3 0 006 0V6" />
                    <path d="M3 8a5 5 0 0010 0M8 13v2" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
