"use client";

import { useRef, useState } from "react";
import { LottieIcon } from "@/components/lottie-icon";
import {
  representativeDisclosure,
  representativeLabel,
  type RepresentativeKind,
} from "@/lib/representative";

export interface RepresentativeSnapshot {
  kind: RepresentativeKind;
  name: string;
  provider?: string;
  configured: boolean;
  imageUrl?: string | null;
  videoUrl?: string | null;
  /** The sender's name, for the disclosure sentence. */
  senderName?: string | null;
  /** Credits a training run costs. */
  trainingCost?: number;
  /** Whether a photo avatar is already trained. */
  hasPhotoAvatar?: boolean;
  /** The configured persona (Synthesia/Masky) id, if any. */
  personaId?: string | null;
  /** The configured persona's display name. */
  personaName?: string | null;
  /** The configured persona's image, if the sender supplied one. */
  personaImageUrl?: string | null;
}

type TrainingState = "idle" | "uploading" | "processing" | "ready" | "failed";

/**
 * Who answers.
 *
 * An avatar app must show the avatar. This is where the sender chooses
 * between the two honest promises — their own face, or a disclosed persona
 * that stands in for them — and sees exactly what the prospect will see,
 * including the sentence the prospect will read.
 */
export function RepresentativeSetup({
  snapshot,
  onChanged,
  saving,
}: {
  snapshot: RepresentativeSnapshot;
  onChanged: () => void | Promise<void>;
  saving?: boolean;
}) {
  const [training, setTraining] = useState<TrainingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const kind = snapshot.kind;
  const disclosure = representativeDisclosure({
    kind,
    senderName: snapshot.senderName ?? "",
    representativeName: kind === "persona" ? snapshot.personaName ?? "" : "",
  });

  async function handleFile(file: File) {
    setError(null);
    setTraining("uploading");
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await fetch("/api/anam/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: dataUrl,
          name: snapshot.senderName ? `${snapshot.senderName}'s representative` : "My representative",
          representativeName: snapshot.senderName ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not train the avatar");
      }
      const result = (await res.json()) as { avatarId: string };
      setTraining("processing");
      await onChanged();

      // The avatar renders asynchronously; poll until it has a video.
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        const statusRes = await fetch(`/api/anam/avatar?id=${encodeURIComponent(result.avatarId)}`);
        if (!statusRes.ok) break;
        const status = (await statusRes.json()) as { status?: string; error?: string };
        if (status.status === "completed") {
          setTraining("ready");
          await onChanged();
          return;
        }
        if (status.status === "failed") {
          throw new Error(status.error || "Avatar training failed");
        }
      }
      setTraining("ready");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not train the avatar");
      setTraining("failed");
    }
  }

  const media = snapshot.videoUrl || snapshot.imageUrl;
  const isVideo = Boolean(snapshot.videoUrl);

  return (
    <div className="space-y-4">
      {/* The preview: what the prospect sees, and the sentence they read. */}
      <div className="rounded-xl border border-cream-dark bg-cream/40 p-4 space-y-3">
        <div className="flex items-start gap-3">
          {media ? (
            isVideo ? (
              <video
                ref={videoRef}
                src={snapshot.videoUrl ?? undefined}
                muted
                loop
                playsInline
                onPlay={() => setVideoPlaying(true)}
                onPause={() => setVideoPlaying(false)}
                className="w-16 h-16 rounded-xl object-cover border border-cream-dark bg-ink shrink-0"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={snapshot.imageUrl ?? ""}
                alt="Your AI representative"
                className="w-16 h-16 rounded-xl object-cover border border-cream-dark bg-white shrink-0"
              />
            )
          ) : (
            <span className="w-16 h-16 rounded-xl bg-cream-dark/70 border border-cream-dark flex items-center justify-center text-ink-faint shrink-0">
              <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="9" r="3.5" />
                <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
              </svg>
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-body-xs font-medium text-ink">
              {representativeLabel(
                { kind, name: snapshot.personaName ?? snapshot.name, configured: snapshot.configured },
                snapshot.senderName ?? undefined,
              )}
            </p>
            <p className="text-label-base text-ink-muted mt-1 leading-relaxed">
              {disclosure}
            </p>
            {media && isVideo && (
              <button
                type="button"
                onClick={() => {
                  const el = videoRef.current;
                  if (!el) return;
                  if (videoPlaying) el.pause();
                  else void el.play();
                }}
                className="mt-1.5 text-label-base uppercase tracking-widest font-medium text-accent hover:text-accent/80 transition-colors"
              >
                {videoPlaying ? "Pause preview" : "Play preview"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Path 1 — the sender's own face. */}
      <div className="rounded-xl border border-cream-dark bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-[420px]">
            <p className="text-body-sm font-medium text-ink">Use my photo</p>
            <p className="text-label-base text-ink-muted mt-1 leading-relaxed">
              Your representative answers with your face. The prospect is told
              plainly that it is an AI using your photo.
              {typeof snapshot.trainingCost === "number" && (
                <> Costs {snapshot.trainingCost} credit{snapshot.trainingCost === 1 ? "" : "s"} to train.</>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving || training === "uploading" || training === "processing"}
            className="btn-press shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-ink text-cream px-3 py-2 text-body-xs font-medium hover:bg-ink-light transition-colors disabled:opacity-50 min-h-[44px]"
          >
            {training === "uploading" || training === "processing" ? (
              <>
                <LottieIcon name="spinner-light" className="w-3 h-3" />
                Training…
              </>
            ) : snapshot.hasPhotoAvatar ? (
              "Replace photo"
            ) : (
              "Upload a photo"
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleFile(file);
            }}
          />
        </div>
        {training === "processing" && (
          <p className="text-label-base text-ink-muted" role="status">
            Rendering your representative — this takes a minute. You can keep working.
          </p>
        )}
        {error && (
          <p className="text-label-base text-warm" role="status">
            {error}
          </p>
        )}
      </div>

      {/* Path 2 — a disclosed persona that stands in for them. */}
      <div className="rounded-xl border border-cream-dark bg-white p-4 space-y-2">
        <p className="text-body-sm font-medium text-ink">Use a disclosed persona</p>
        <p className="text-label-base text-ink-muted leading-relaxed">
          A representative that is not you, standing in for you. The prospect is
          told it is not the sender. Use this if a representative persona is
          right for your brand —{" "}
          <a href="/setup#representative-advanced" className="text-accent hover:text-accent/80 underline">
            set it up below
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image"));
    reader.readAsDataURL(file);
  });
}
