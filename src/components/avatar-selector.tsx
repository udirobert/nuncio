"use client";

import { useRef, useState } from "react";
import { LottieIcon } from "@/components/lottie-icon";
import type { HeyGenAvatar } from "@/lib/heygen";

interface AvatarSelectorProps {
  avatars: HeyGenAvatar[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  selectedAvatar?: HeyGenAvatar;
  photoUploading: boolean;
  photoAvatarStatus: "idle" | "uploading" | "processing" | "ready" | "failed";
  onPhotoUpload: (file: File) => void;
}

export function AvatarSelector({
  avatars,
  selectedIndex,
  onSelect,
  selectedAvatar,
  photoUploading,
  photoAvatarStatus,
  onPhotoUpload,
}: AvatarSelectorProps) {
  const [previewingAvatarId, setPreviewingAvatarId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onPhotoUpload(file);
  }

  if (avatars.length === 0) return null;

  return (
    <div className="space-y-2">
      <label className="text-label-sm uppercase tracking-widest font-medium text-ink-faint">
        Avatar
      </label>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {avatars.slice(0, 24).map((avatar, i) => {
          const isPlaying = previewingAvatarId === avatar.avatar_id;
          const hasPreview = !!avatar.preview_video_url;
          return (
            <div key={avatar.avatar_id} className="relative shrink-0">
              <button
                onClick={() => onSelect(i)}
                className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-[color,background-color,border-color,opacity,box-shadow,transform] ${
                  i === selectedIndex
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
                      videoRef.current?.pause();
                      videoRef.current = null;
                      setPreviewingAvatarId(avatar.avatar_id);
                    }
                  }}
                  className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-sm border transition-[color,background-color,border-color,opacity,box-shadow,transform] ${
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
        <p className="text-label-base text-ink-muted truncate">
          {selectedAvatar.avatar_name} · {selectedAvatar.gender}
          {previewingAvatarId && selectedAvatar.avatar_id === previewingAvatarId && (
            <span className="text-accent/70 ml-1">· Previewing</span>
          )}
        </p>
      )}
      {/* Use your photo */}
      <div className="flex items-center gap-2 pt-1">
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => photoInputRef.current?.click()}
          disabled={photoUploading || photoAvatarStatus === "processing"}
          className="text-label-base text-accent hover:text-accent/80 disabled:opacity-50 flex items-center gap-1 transition-colors"
        >
          <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="12" height="10" rx="2" />
            <circle cx="5.5" cy="6.5" r="1.5" />
            <path d="M14 11l-3-3-2 2-3-3-4 4" />
          </svg>
          {photoAvatarStatus === "processing" || photoUploading ? (
            <>
              <LottieIcon name="spinner" className="w-3 h-3" />
              {photoAvatarStatus === "processing" ? "Processing..." : "Uploading..."}
            </>
          ) : (
            "Use your photo"
          )}
        </button>
        {photoAvatarStatus === "ready" && (
          <span className="text-label-sm text-success">Ready</span>
        )}
        {photoAvatarStatus === "failed" && (
          <span className="text-label-sm text-error">Failed</span>
        )}
      </div>
    </div>
  );
}
