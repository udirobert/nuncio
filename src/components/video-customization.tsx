"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { VideoCustomization, HeyGenAvatar, HeyGenVoice } from "@/lib/heygen";

const BACKGROUND_PRESETS = [
  { label: "White", value: "#FFFFFF" },
  { label: "Light gray", value: "#F0F0F0" },
  { label: "Warm beige", value: "#F5EDE3" },
  { label: "Cool blue", value: "#E8EEF5" },
  { label: "Soft sage", value: "#E8F0EA" },
  { label: "Dark slate", value: "#2A2A2E" },
];

const ASPECT_RATIOS = [
  { label: "Landscape 16:9", width: 1920, height: 1080, icon: "▭" },
  { label: "Portrait 9:16", width: 1080, height: 1920, icon: "▯" },
  { label: "Square 1:1", width: 1080, height: 1080, icon: "▢" },
];

const CACHE_KEY_AVATARS = "nuncio_heygen_avatars";
const CACHE_KEY_VOICES = "nuncio_heygen_voices";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T) {
  try {
    const entry: CacheEntry<T> = { data, fetchedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

interface VideoCustomizationProps {
  onCustomize: (customization: VideoCustomization) => void;
  initialAvatars?: HeyGenAvatar[];
  initialVoices?: HeyGenVoice[];
}

export function VideoCustomization({ onCustomize, initialAvatars, initialVoices }: VideoCustomizationProps) {
  const [avatars, setAvatars] = useState<HeyGenAvatar[]>(
    () => initialAvatars || readCache<HeyGenAvatar[]>(CACHE_KEY_AVATARS) || []
  );
  const [voices, setVoices] = useState<HeyGenVoice[]>(
    () => initialVoices || readCache<HeyGenVoice[]>(CACHE_KEY_VOICES) || []
  );
  const [loading, setLoading] = useState(
    () => !(initialAvatars?.length || readCache<HeyGenAvatar[]>(CACHE_KEY_AVATARS)?.length)
  );

  const [avatarIndex, setAvatarIndex] = useState(0);
  const [voiceIndex, setVoiceIndex] = useState(0);
  const [backgroundColor, setBackgroundColor] = useState("#F5EDE3");
  const [customBg, setCustomBg] = useState("");
  const [aspectIndex, setAspectIndex] = useState(0);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [previewingAvatarId, setPreviewingAvatarId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Cleanup audio and video on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      videoRef.current?.pause();
    };
  }, []);

  // Seed cache with server-provided data so it's available on re-visit
  useEffect(() => {
    if (initialAvatars?.length) {
      writeCache(CACHE_KEY_AVATARS, initialAvatars);
    }
    if (initialVoices?.length) {
      writeCache(CACHE_KEY_VOICES, initialVoices);
    }
  }, [initialAvatars, initialVoices]);

  // Fetch from API if no server data was provided (e.g., on other pages)
  useEffect(() => {
    // If server already provided data, skip the client fetch entirely
    if (initialAvatars?.length && initialVoices?.length) {
      return;
    }

    async function load() {
      const cachedAvatars = readCache<HeyGenAvatar[]>(CACHE_KEY_AVATARS);
      const cachedVoices = readCache<HeyGenVoice[]>(CACHE_KEY_VOICES);

      if (cachedAvatars && cachedAvatars.length > 0 && cachedVoices && cachedVoices.length > 0) {
        setAvatars(cachedAvatars);
        setVoices(cachedVoices);
        setLoading(false);
        return;
      }

      try {
        const [avatarRes, voiceRes] = await Promise.all([
          fetch("/api/heygen/avatars"),
          fetch("/api/heygen/voices"),
        ]);
        const avatarData = await avatarRes.json();
        const voiceData = await voiceRes.json();
        const freshAvatars: HeyGenAvatar[] = avatarData.avatars || [];
        const freshVoices: HeyGenVoice[] = voiceData.voices || [];

        writeCache(CACHE_KEY_AVATARS, freshAvatars);
        writeCache(CACHE_KEY_VOICES, freshVoices);

        setAvatars(freshAvatars);
        setVoices(freshVoices);
      } catch {
        // Silently fail — users can still proceed with defaults or cached data
      }
      setLoading(false);
    }
    load();
  }, []); // Only runs once on mount if state is empty

  // Emit customization changes
  useEffect(() => {
    const aspect = ASPECT_RATIOS[aspectIndex];
    const selectedAvatar = avatars[avatarIndex];
    const selectedVoice = voices[voiceIndex];
    onCustomize({
      avatarId: selectedAvatar?.avatar_id,
      voiceId: selectedVoice?.voice_id,
      background: backgroundColor
        ? { type: "color" as const, value: backgroundColor }
        : undefined,
      width: aspect.width,
      height: aspect.height,
    });
  }, [avatarIndex, voiceIndex, backgroundColor, aspectIndex, avatars, voices, onCustomize]);

  const uniqueVoices = voices.filter(
    (v, i, a) => a.findIndex((x) => x.voice_id === v.voice_id) === i
  );

  const selectedAvatar = avatars[avatarIndex];
  const selectedVoice = voices[voiceIndex];
  const playingVoice = uniqueVoices.find((v) => v.voice_id === playingVoiceId);
  const aspect = ASPECT_RATIOS[aspectIndex];

  if (loading) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-cream-dark/30 animate-pulse">
        <div className="w-4 h-4 rounded-full bg-ink-faint/20" />
        <div className="h-3 w-32 bg-ink-faint/20 rounded" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-cream-dark bg-white p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 16 16" className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="5" r="3" />
            <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" />
          </svg>
          <span className="text-xs font-medium text-ink">Video customization</span>
        </div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[10px] text-ink-faint hover:text-accent transition-colors"
        >
          {showAdvanced ? "Hide advanced" : "Show advanced"}
        </button>
      </div>

      {/* Avatar selector */}
      {avatars.length > 0 && (
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest font-medium text-ink-faint">
            Avatar
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {avatars.slice(0, 24).map((avatar, i) => {
              const isPlaying = previewingAvatarId === avatar.avatar_id;
              const hasPreview = !!avatar.preview_video_url;
              return (
                <div key={avatar.avatar_id} className="relative shrink-0">
                  <button
                    onClick={() => setAvatarIndex(i)}
                    className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                      i === avatarIndex
                        ? "border-accent ring-2 ring-accent/20"
                        : "border-cream-dark hover:border-ink-faint/30"
                    } ${isPlaying ? "ring-2 ring-accent/40" : ""}`}
                    title={avatar.avatar_name}
                  >
                    {isPlaying ? (
                      <video
                        ref={(el) => {
                          if (el) {
                            videoRef.current = el;
                            el.muted = true;
                            el.loop = false;
                            el.playsInline = true;
                            el.play().catch(() => {});
                            el.onended = () =>
                              setPreviewingAvatarId((prev) =>
                                prev === avatar.avatar_id ? null : prev
                              );
                          }
                        }}
                        src={avatar.preview_video_url}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={avatar.preview_image_url}
                        alt={avatar.avatar_name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </button>
                  {hasPreview && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isPlaying) {
                          videoRef.current?.pause();
                          videoRef.current = null;
                          setPreviewingAvatarId(null);
                        } else {
                          // Stop any previous video
                          videoRef.current?.pause();
                          videoRef.current = null;
                          setPreviewingAvatarId(avatar.avatar_id);
                        }
                      }}
                      className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-sm border transition-all ${
                        isPlaying
                          ? "bg-accent text-white border-accent"
                          : "bg-white text-ink-faint border-cream-dark hover:text-accent hover:border-accent"
                      }`}
                      title={isPlaying ? "Stop preview" : "Preview avatar"}
                      aria-label={isPlaying ? "Stop preview" : "Preview avatar"}
                    >
                      {isPlaying ? (
                        <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="currentColor">
                          <rect x="1.5" y="1" width="2.5" height="8" rx="0.5" />
                          <rect x="6" y="1" width="2.5" height="8" rx="0.5" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="currentColor">
                          <polygon points="2.5,1 8.5,5 2.5,9" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {selectedAvatar && (
            <p className="text-[11px] text-ink-muted truncate">
              {selectedAvatar.avatar_name} · {selectedAvatar.gender}
              {previewingAvatarId && selectedAvatar.avatar_id === previewingAvatarId && (
                <span className="text-accent/70 ml-1">· Previewing</span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Voice selector */}
      {uniqueVoices.length > 0 && (
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest font-medium text-ink-faint">
            Voice
          </label>
          <div className="flex flex-wrap gap-1.5">
            {uniqueVoices.slice(0, 12).map((voice, i) => (
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
                    className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[9px] transition-all ${
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
                  onClick={() => setVoiceIndex(i)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-all ${
                    i === voiceIndex
                      ? "border-accent bg-accent-soft/40 text-accent font-medium"
                      : "border-cream-dark text-ink-muted hover:border-ink-faint/30"
                  }`}
                >
                  {voice.name}
                </button>
              </div>
            ))}
          </div>
          {playingVoice && (
            <p className="text-[10px] text-accent/70 animate-pulse">
              Playing {playingVoice.name}…
            </p>
          )}
        </div>
      )}

      {/* Aspect ratio */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-widest font-medium text-ink-faint">
          Aspect ratio
        </label>
        <div className="flex gap-2">
          {ASPECT_RATIOS.map((ratio, i) => (
            <button
              key={ratio.label}
              onClick={() => setAspectIndex(i)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-all ${
                i === aspectIndex
                  ? "border-accent bg-accent-soft/40 text-accent font-medium"
                  : "border-cream-dark text-ink-muted hover:border-ink-faint/30"
              }`}
            >
              <span className="text-sm">{ratio.icon}</span>
              {ratio.label}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced: Background + tone */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 overflow-hidden"
          >
            {/* Background color */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-medium text-ink-faint">
                Background
              </label>
              <div className="flex gap-2 flex-wrap">
                {BACKGROUND_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => {
                      setBackgroundColor(preset.value);
                      setCustomBg("");
                      setShowBgPicker(false);
                    }}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      backgroundColor === preset.value && !customBg
                        ? "border-accent ring-2 ring-accent/20 scale-110"
                        : "border-cream-dark hover:border-ink-faint/30"
                    }`}
                    style={{ backgroundColor: preset.value }}
                    title={preset.label}
                  />
                ))}
                <button
                  onClick={() => setShowBgPicker(!showBgPicker)}
                  className={`w-8 h-8 rounded-lg border-2 border-dashed flex items-center justify-center text-xs text-ink-faint transition-all ${
                    showBgPicker || customBg
                      ? "border-accent"
                      : "border-cream-dark hover:border-ink-faint/30"
                  }`}
                  title="Custom color"
                >
                  +
                </button>
              </div>
              {showBgPicker && (
                <input
                  type="color"
                  value={customBg || backgroundColor}
                  onChange={(e) => {
                    setCustomBg(e.target.value);
                    setBackgroundColor(e.target.value);
                  }}
                  className="w-full h-8 rounded-lg border border-cream-dark cursor-pointer"
                />
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between text-[10px] text-ink-faint pt-1 border-t border-cream-dark/40">
              <span>
                {avatars.length} avatars · {uniqueVoices.length} voices
              </span>
              <span>
                {aspect.width}×{aspect.height}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
