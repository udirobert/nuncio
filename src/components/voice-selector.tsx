"use client";

import { useRef, useState } from "react";
import { LottieIcon } from "@/components/lottie-icon";
import type { HeyGenVoice } from "@/lib/heygen";

interface VoiceSelectorProps {
  voices: HeyGenVoice[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  selectedVoice?: HeyGenVoice;
  voiceCloneStatus: "idle" | "uploading" | "processing" | "ready" | "failed";
  voiceCloneUploading: boolean;
  onVoiceUpload: (file: File) => void;
  script?: string;
  suggestedLanguage?: string;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
}

export function VoiceSelector({
  voices,
  selectedIndex,
  onSelect,
  selectedVoice,
  voiceCloneStatus,
  voiceCloneUploading,
  onVoiceUpload,
  script,
  suggestedLanguage,
  audioRef,
}: VoiceSelectorProps) {
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [scriptAuditionLoading, setScriptAuditionLoading] = useState(false);
  const voiceInputRef = useRef<HTMLInputElement | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onVoiceUpload(file);
  }

  const uniqueVoices = voices
    .filter((v, i, a) => a.findIndex((x) => x.voice_id === v.voice_id) === i)
    .sort((a, b) => {
      if (!suggestedLanguage) return 0;
      const lang = suggestedLanguage.toLowerCase();
      const aMatch = a.language?.toLowerCase().includes(lang) ? 1 : 0;
      const bMatch = b.language?.toLowerCase().includes(lang) ? 1 : 0;
      return bMatch - aMatch;
    });

  const playingVoice = uniqueVoices.find((v) => v.voice_id === playingVoiceId);

  if (uniqueVoices.length === 0) return null;

  return (
    <div className="space-y-2">
      <label className="text-label-sm uppercase tracking-widest font-medium text-ink-faint">
        Voice
      </label>
      <div className="flex flex-wrap gap-1.5">
        {uniqueVoices.slice(0, 12).map((voice) => {
          const isSelected = voice.voice_id === voices[selectedIndex]?.voice_id;
          const originalIndex = voices.findIndex((v) => v.voice_id === voice.voice_id);
          return (
            <div key={voice.voice_id} className="flex items-center gap-0.5">
              {voice.preview_audio && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const el = audioRef.current;
                    if (playingVoiceId === voice.voice_id) {
                      el?.pause();
                      setPlayingVoiceId(null);
                    } else {
                      if (el) {
                        el.pause();
                        el.currentTime = 0;
                      }
                      const audio = new Audio(voice.preview_audio);
                      const currentId = voice.voice_id;
                      audio.onended = () =>
                        setPlayingVoiceId((prev) => (prev === currentId ? null : prev));
                      audioRef.current = audio;
                      audio.play().catch(() => {});
                      setPlayingVoiceId(voice.voice_id);
                    }
                  }}
                  className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-label-xs transition-[color,background-color,border-color,opacity,box-shadow,transform] ${
                    playingVoiceId === voice.voice_id
                      ? "bg-accent text-white"
                      : "text-ink-faint hover:text-accent hover:bg-cream-dark/40"
                  }`}
                  title={playingVoiceId === voice.voice_id ? "Stop preview" : "Preview voice"}
                  aria-label={playingVoiceId === voice.voice_id ? "Stop preview" : "Preview voice"}
                >
                  {playingVoiceId === voice.voice_id ? (
                    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="currentColor">
                      <rect x="2" y="1" width="3" height="10" rx="0.5" />
                      <rect x="7" y="1" width="3" height="10" rx="0.5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="currentColor">
                      <polygon points="3,1 11,6 3,11" />
                    </svg>
                  )}
                </button>
              )}
              <button
                onClick={() => onSelect(originalIndex)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-[color,background-color,border-color,opacity,box-shadow,transform] ${
                  isSelected
                    ? "border-accent bg-accent-soft/40 text-accent font-medium"
                    : "border-cream-dark text-ink-muted hover:border-ink-faint/30"
                }`}
              >
                {voice.name}
              </button>
            </div>
          );
        })}
      </div>
      {playingVoice && (
        <p className="text-label-sm text-accent/70 animate-pulse">
          Playing {playingVoice.name}…
        </p>
      )}

      {/* Script audition — hear selected voice reading actual script */}
      {script && selectedVoice && (
        <button
          onClick={async () => {
            if (scriptAuditionLoading) return;
            audioRef.current?.pause();
            setPlayingVoiceId(null);
            setScriptAuditionLoading(true);
            try {
              const previewText = script.slice(0, 200) + (script.length > 200 ? "..." : "");
              const res = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: previewText, voiceId: selectedVoice.voice_id }),
              });
              if (res.ok) {
                const { audio } = await res.json();
                const el = new Audio(audio);
                el.onended = () => setPlayingVoiceId(null);
                audioRef.current = el;
                setPlayingVoiceId(selectedVoice.voice_id);
                el.play().catch(() => {});
              }
            } catch { /* noop */ }
            setScriptAuditionLoading(false);
          }}
          disabled={scriptAuditionLoading}
          className="text-label-base text-accent hover:text-accent/80 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
        >
          <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 3l9 5-9 5V3z" />
          </svg>
          {scriptAuditionLoading ? (
            <>
              <LottieIcon name="spinner" className="w-3 h-3" />
              Generating preview...
            </>
          ) : (
            "Preview with your script"
          )}
        </button>
      )}

      {/* Use your voice */}
      <div className="flex items-center gap-2 pt-1">
        <input
          ref={voiceInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => voiceInputRef.current?.click()}
          disabled={voiceCloneUploading || voiceCloneStatus === "processing"}
          className="text-label-base text-accent hover:text-accent/80 disabled:opacity-50 flex items-center gap-1 transition-colors"
        >
          <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2v8M5 6v4a3 3 0 006 0V6" />
            <path d="M3 8a5 5 0 0010 0M8 13v2" />
          </svg>
          {voiceCloneStatus === "processing" || voiceCloneUploading ? (
            <>
              <LottieIcon name="spinner" className="w-3 h-3" />
              {voiceCloneStatus === "processing" ? "Cloning..." : "Uploading..."}
            </>
          ) : (
            "Use your voice"
          )}
        </button>
        {voiceCloneStatus === "ready" && (
          <span className="text-label-sm text-success">Ready</span>
        )}
        {voiceCloneStatus === "failed" && (
          <span className="text-label-sm text-error">Failed</span>
        )}
      </div>
    </div>
  );
}
