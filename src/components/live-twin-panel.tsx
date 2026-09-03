"use client";

import { LIVE_SESSION_CREDITS_PER_MINUTE, LIVE_SESSION_MAX_CREDITS } from "@/lib/live-link";

export type AnamAssetStatus = "idle" | "uploading" | "processing" | "ready" | "failed";

interface LiveTwinPanelProps {
  liveLinkEnabled?: boolean;
  deliveryMode?: "video" | "livelink";
  mode?: "outreach" | "reconnect";
  liveTwinEnabled?: boolean;
  onToggle?: () => void;
  creditBalance?: number;
  trainingCreditCost?: number;
  anamAvatarStatus?: AnamAssetStatus;
  anamVoiceStatus?: AnamAssetStatus;
  anamAvatarError?: string | null;
  anamVoiceError?: string | null;
  onDeliveryModeChange?: (mode: "video" | "livelink") => void;
}

export function LiveTwinPanel({
  liveLinkEnabled = false,
  deliveryMode = "video",
  mode = "outreach",
  liveTwinEnabled = false,
  onToggle,
  creditBalance,
  trainingCreditCost = 2,
  anamAvatarStatus = "idle",
  anamVoiceStatus = "idle",
  anamAvatarError,
  anamVoiceError,
  onDeliveryModeChange,
}: LiveTwinPanelProps) {
  const insufficientCredits =
    typeof creditBalance === "number" && creditBalance < trainingCreditCost;

  // Live twin configuration only appears when the deployment supports live link
  // and the user is actively in live-link mode.
  const showLiveTwinSection = liveLinkEnabled && deliveryMode === "livelink";

  // Cross-sell appears in recorded-video B2B mode, but only if live link is
  // actually enabled for this deployment. If live link is disabled, we hide
  // the prompt entirely rather than tease an unavailable feature.
  const showCrossSell =
    liveLinkEnabled && deliveryMode === "video" && mode === "outreach";

  return (
    <>
      {showLiveTwinSection && (
        <div className="space-y-3 pt-2 border-t border-cream-dark/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <label className="text-label-sm uppercase tracking-widest font-medium text-ink-faint block">
                Live twin
              </label>
              <p className="text-label-base text-ink-muted mt-0.5">
                Train a talkable AI twin from your photo and voice for real-time conversations.
                Estimated cost: <strong>{trainingCreditCost} credits</strong> to train;
                conversations use <strong>{LIVE_SESSION_CREDITS_PER_MINUTE} credit/min</strong> (max {LIVE_SESSION_MAX_CREDITS} per session).
              </p>
            </div>
            <button
              type="button"
              onClick={onToggle}
              disabled={insufficientCredits}
              aria-pressed={liveTwinEnabled}
              aria-disabled={insufficientCredits}
              className={`relative w-9 h-5 rounded-full transition-colors ${liveTwinEnabled ? "bg-accent" : "bg-cream-dark"} ${insufficientCredits ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${liveTwinEnabled ? "translate-x-4" : ""}`}
              />
            </button>
          </div>

          {typeof creditBalance === "number" && (
            <p className={`text-label-base ${insufficientCredits ? "text-warm" : "text-ink-faint"}`}>
              {insufficientCredits
                ? `You need at least ${trainingCreditCost} credits to train a live twin.`
                : `${creditBalance} credits available.`}
              {insufficientCredits && (
                <a href="/pricing" className="ml-1.5 text-accent hover:text-accent/80 underline">
                  Top up
                </a>
              )}
            </p>
          )}

          {liveTwinEnabled && (
            <div className="flex flex-wrap gap-2 text-label-sm">
              <AssetStatusChip
                label="Live avatar"
                status={anamAvatarStatus}
              />
              <AssetStatusChip
                label="Live voice"
                status={anamVoiceStatus}
              />
            </div>
          )}

          {(anamAvatarError || anamVoiceError) && liveTwinEnabled && (
            <div className="space-y-1 text-label-base text-warm">
              {anamAvatarError && <p>{anamAvatarError}</p>}
              {anamVoiceError && <p>{anamVoiceError}</p>}
            </div>
          )}

          {deliveryMode === "livelink" && !liveTwinEnabled && !insufficientCredits && (
            <p className="text-label-base text-warm">
              Live link mode is on, but you haven&apos;t enabled a live twin. Switch to Video or enable this to use your own face and voice.
            </p>
          )}
        </div>
      )}

      {showCrossSell && (
        <div className="space-y-2 pt-2 border-t border-cream-dark/40">
          <p className="text-label-base text-ink-muted">
            This produces a recorded video.{" "}
            <button
              type="button"
              onClick={() => onDeliveryModeChange?.("livelink")}
              className="text-accent hover:text-accent/80 underline font-medium"
            >
              Switch to Live link
            </button>{" "}
            if you also want recipients to talk to your AI twin.
          </p>
        </div>
      )}
    </>
  );
}

function AssetStatusChip({ label, status }: { label: string; status: AnamAssetStatus }) {
  const styles =
    status === "ready"
      ? "bg-success-soft border-success/20 text-success"
      : status === "failed"
        ? "bg-error-soft border-error/20 text-error"
        : status === "processing" || status === "uploading"
          ? "bg-accent-soft/30 border-accent/15 text-ink-muted"
          : "bg-cream-dark/40 border-cream-dark text-ink-muted";

  const text =
    status === "ready"
      ? "ready"
      : status === "failed"
        ? "failed"
        : status === "processing" || status === "uploading"
          ? "training"
          : "not uploaded";

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border ${styles}`}>
      {label} {text}
    </span>
  );
}
