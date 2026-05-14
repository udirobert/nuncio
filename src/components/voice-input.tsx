"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  placeholder?: string;
}

type RecordingState = "idle" | "recording" | "processing";

export function VoiceInput({ onTranscript, placeholder }: VoiceInputProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        // Clear timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        setState("processing");

        // Send to transcription API
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", blob, "voice-note.webm");

        try {
          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          if (response.ok) {
            const { transcript } = await response.json();
            if (transcript) {
              onTranscript(transcript);
            }
          }
        } catch (error) {
          console.error("[voice-input] Transcription failed:", error);
        }

        setState("idle");
        setDuration(0);
      };

      mediaRecorder.start(250); // Collect data every 250ms
      setState("recording");

      // Start duration timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } catch (error) {
      console.error("[voice-input] Microphone access denied:", error);
      setState("idle");
    }
  }, [onTranscript]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {state === "idle" && (
          <motion.button
            key="idle"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={startRecording}
            className="flex items-center gap-2 text-xs text-ink-faint hover:text-accent transition-colors"
            title={placeholder || "Record a voice note"}
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="5" y="1" width="6" height="10" rx="3" />
              <path d="M3 7a5 5 0 0010 0M8 12v3M6 15h4" />
            </svg>
            {placeholder || "Or record a voice note"}
          </motion.button>
        )}

        {state === "recording" && (
          <motion.button
            key="recording"
            type="button"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={stopRecording}
            className="flex items-center gap-3 rounded-xl bg-error-soft border border-error/20 px-4 py-2.5 text-sm text-error transition-colors hover:bg-error/10"
          >
            {/* Pulsing recording indicator */}
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-error" />
            </span>
            <span className="font-[family-name:var(--font-mono)] text-xs">
              {formatDuration(duration)}
            </span>
            <span className="text-xs">Tap to stop</span>
          </motion.button>
        )}

        {state === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-xs text-accent"
          >
            <motion.div
              className="flex gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {[0, 1, 2].map((dot) => (
                <motion.span
                  key={dot}
                  className="w-1.5 h-1.5 rounded-full bg-accent"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: dot * 0.15 }}
                />
              ))}
            </motion.div>
            Transcribing with Speechmatics...
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
