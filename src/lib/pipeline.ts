import type { Profile } from "@/lib/claude";
import type { AgentTraceItem, CanvasProof, ShareRecord } from "@/lib/artifacts";
import { buildAgentTrace } from "@/lib/artifacts";
import {
  DEMO_PROFILE,
  DEMO_SCRIPT,
  DEMO_SOURCES,
  DEMO_VIDEO_URL,
  demoDelay,
} from "@/lib/demo";

export interface StepState {
  id: string;
  label: string;
  status: "pending" | "active" | "complete" | "failed";
  elapsed?: number;
}

export interface EnrichmentWarning {
  url: string;
  reason: string;
}

export interface PipelineState {
  stage: "input" | "progress" | "coach" | "review" | "done" | "error";
  steps: StepState[];
  urls?: string[];
  profile?: Profile;
  script?: string;
  sources?: string[];
  warnings?: EnrichmentWarning[];
  selectedAngles?: { label: string; evidence: string; why_chosen: string }[];
  enrichedMarkdown?: string[];
  senderBrief?: string;
  intent?: string;
  assetUrls?: string[];
  canvas?: CanvasProof;
  trace?: AgentTraceItem[];
  videoUrl?: string;
  videoId?: string;
  share?: ShareRecord;
  error?: string;
  isDemo?: boolean;
}

const INITIAL_STEPS: StepState[] = [
  { id: "enrich", label: "Fetching profiles", status: "pending" },
  { id: "script", label: "Analysing context", status: "pending" },
  { id: "canvas", label: "Composing visuals", status: "pending" },
  { id: "video", label: "Rendering video", status: "pending" },
];

type SetState = (
  updater: PipelineState | ((prev: PipelineState) => PipelineState)
) => void;

function updateStep(
  setState: SetState,
  stepId: string,
  update: Partial<StepState>
) {
  setState((prev) => ({
    ...prev,
    steps: prev.steps.map((s) =>
      s.id === stepId ? { ...s, ...update } : s
    ),
  }));
}

/**
 * Check if demo mode is active.
 */
export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("demo") === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  );
}

/**
 * Run the full nuncio pipeline: enrich → script → canvas → video
 * In demo mode, uses cached data with artificial delays.
 */
export async function generateVideo(
  urls: string[],
  setState: SetState,
  senderBrief?: string,
  intent?: string
) {
  const demo = isDemoMode();

  // Track funnel start
  if (typeof window !== "undefined") {
    import("@/lib/analytics").then(({ trackFormSubmitted }) => {
      trackFormSubmitted({
        urlCount: urls.length,
        platforms: urls.map((u) => {
          try { return new URL(u).hostname; } catch { return "unknown"; }
        }),
        hasBrief: !!senderBrief,
        intent: intent || null,
        isDemo: demo,
      });
    });
  }

  setState({
    stage: "progress",
    urls,
    steps: INITIAL_STEPS.map((s, i) => ({
      ...s,
      status: i === 0 ? "active" : "pending",
    })),
    isDemo: demo,
  });

  try {
    if (demo) {
      // Demo mode — simulate pipeline with cached data
      await demoDelay(800);
      updateStep(setState, "enrich", { status: "complete", elapsed: 0.8 });
      updateStep(setState, "script", { status: "active" });

      await demoDelay(1500);
      updateStep(setState, "script", { status: "complete", elapsed: 1.5 });
      updateStep(setState, "canvas", { status: "active" });

      await demoDelay(1000);
      updateStep(setState, "canvas", { status: "complete", elapsed: 1.0 });

      setState((prev) => ({
        ...prev,
        stage: "review",
        profile: DEMO_PROFILE,
        script: DEMO_SCRIPT,
        sources: DEMO_SOURCES,
        assetUrls: [],
        canvas: {
          canvasId: "demo-canvas",
          provider: "demo",
          assetCount: 0,
        },
        trace: buildAgentTrace({
          profile: DEMO_PROFILE,
          sources: DEMO_SOURCES,
          senderBrief,
          canvas: { canvasId: "demo-canvas", provider: "demo", assetCount: 0 },
        }),
      }));
      return;
    }

    // Stage 1: Enrich
    const enrichStart = Date.now();
    const enrichRes = await fetch("/api/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls }),
    });

    if (!enrichRes.ok) {
      throw new Error("Failed to fetch profiles");
    }

    const enrichment = await enrichRes.json();
    const enrichedMarkdown = enrichment
      .filter((r: { success: boolean }) => r.success)
      .map((r: { markdown: string }) => r.markdown);

    if (enrichedMarkdown.length === 0) {
      throw new Error(
        "Could not access any of the provided profiles. Try different URLs."
      );
    }

    const sources = enrichment
      .filter((r: { success: boolean }) => r.success)
      .map((r: { url: string }) => r.url);

    const warnings: EnrichmentWarning[] = enrichment
      .filter((r: { success: boolean }) => !r.success)
      .map((r: { url: string }) => ({
        url: r.url,
        reason: "Couldn't access this profile — continuing without it",
      }));

    updateStep(setState, "enrich", {
      status: "complete",
      elapsed: (Date.now() - enrichStart) / 1000,
    });

    // Synthesise profile for coach mode (quick pass)
    const profileRes = await fetch("/api/script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrichment: enrichedMarkdown, senderBrief, intent, profileOnly: true }),
    });

    let profile: Profile | undefined;
    if (profileRes.ok) {
      const data = await profileRes.json();
      profile = data.profile;
    }

    // Pause at coach mode — let user pick angles
    setState((prev) => ({
      ...prev,
      stage: "coach",
      profile,
      sources,
      warnings,
      enrichedMarkdown,
      senderBrief,
      intent,
    }));
  } catch (error) {
    setState((prev) => ({
      ...prev,
      stage: "error",
      error:
        error instanceof Error ? error.message : "Something went wrong",
    }));
  }
}

/**
 * Continue the pipeline after coach mode.
 * Called when the user picks angles (or auto-skips).
 */
export async function continueAfterCoach(
  setState: SetState,
  enrichedMarkdown: string[] | undefined,
  senderBrief?: string,
  intent?: string,
  selectedAngles?: { label: string; evidence: string; why_chosen: string }[]
) {
  updateStep(setState, "script", { status: "active" });
  setState((prev) => ({ ...prev, stage: "progress", selectedAngles }));

  try {
    // Build enhanced brief with selected angles
    const enhancedBrief = selectedAngles && selectedAngles.length > 0
      ? `${senderBrief || ""}\n\nFocus on these angles:\n${selectedAngles.map((a) => `- ${a.label}: ${a.evidence}`).join("\n")}`
      : senderBrief;

    // Stage 2: Script generation
    const scriptStart = Date.now();
    const scriptRes = await fetch("/api/script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrichment: enrichedMarkdown, senderBrief: enhancedBrief, intent }),
    });

    if (!scriptRes.ok) {
      throw new Error("Failed to generate script");
    }

    const { profile, script } = await scriptRes.json();

    updateStep(setState, "script", {
      status: "complete",
      elapsed: (Date.now() - scriptStart) / 1000,
    });
    updateStep(setState, "canvas", { status: "active" });

    // Stage 3: Canvas
    const canvasStart = Date.now();
    const canvasRes = await fetch("/api/canvas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, script }),
    });

    let assetUrls: string[] = [];
    let canvas: CanvasProof | undefined;
    if (canvasRes.ok) {
      const canvasData = await canvasRes.json();
      assetUrls = canvasData.assetUrls || [];
      canvas = {
        canvasId: canvasData.canvasId,
        provider: canvasData.provider,
        assetCount: canvasData.assetCount ?? assetUrls.length,
        canvasUrl: canvasData.canvasUrl,
        exportUrl: canvasData.exportUrl,
      };
    }
    // Canvas is non-blocking — continue even if it fails

    updateStep(setState, "canvas", {
      status: "complete",
      elapsed: (Date.now() - canvasStart) / 1000,
    });

    // Pause at script review before rendering video
    setState((prev) => ({
      ...prev,
      stage: "review",
      profile,
      script,
      assetUrls,
      canvas,
      trace: buildAgentTrace({ profile, sources: prev.sources, senderBrief: enhancedBrief, canvas }),
    }));
  } catch (error) {
    setState((prev) => ({
      ...prev,
      stage: "error",
      error:
        error instanceof Error ? error.message : "Something went wrong",
    }));
  }
}

/**
 * Render video after script review/edit.
 * In demo mode, returns a sample video URL after a short delay.
 */
export async function renderVideo(
  script: string,
  assetUrls: string[],
  setState: SetState,
  recipientName?: string,
  context?: {
    profile?: Profile;
    sources?: string[];
    canvas?: CanvasProof;
    trace?: AgentTraceItem[];
  }
) {
  const demo = isDemoMode();

  updateStep(setState, "video", { status: "active" });
  setState((prev) => ({ ...prev, stage: "progress" }));

  try {
    if (demo) {
      await demoDelay(3000);
      updateStep(setState, "video", { status: "complete", elapsed: 3.0 });

      const trace = buildAgentTrace({
        profile: context?.profile,
        sources: context?.sources,
        canvas: context?.canvas,
        videoId: "demo-video",
      });

      let share: ShareRecord | undefined;
      try {
        const shareRes = await fetch("/api/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoUrl: DEMO_VIDEO_URL,
            videoId: "demo-video",
            recipientName,
            profile: context?.profile,
            sources: context?.sources,
            canvas: context?.canvas,
            trace,
          }),
        });

        if (shareRes.ok) {
          const shareData = await shareRes.json();
          share = shareData.record;
        }
      } catch {
        // Keep demo resilient even if the local share endpoint is unavailable.
      }

      setState((prev) => ({
        ...prev,
        stage: "done",
        videoUrl: DEMO_VIDEO_URL,
        videoId: "demo-video",
        share,
        trace,
      }));
      return;
    }

    const videoStart = Date.now();
    const videoRes = await fetch("/api/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script, assetUrls, recipientName }),
    });

    if (!videoRes.ok) {
      throw new Error("Failed to start video render");
    }

    const { videoId } = await videoRes.json();

    // Poll for completion
    let videoUrl: string | undefined;
    while (!videoUrl) {
      await new Promise((r) => setTimeout(r, 5000));
      const statusRes = await fetch(`/api/video/${videoId}`);
      const status = await statusRes.json();

      if (status.status === "completed") {
        videoUrl = status.videoUrl;
      } else if (status.status === "failed") {
        throw new Error("Video generation failed");
      }
    }

    updateStep(setState, "video", {
      status: "complete",
      elapsed: (Date.now() - videoStart) / 1000,
    });

    const trace = buildAgentTrace({
      profile: context?.profile,
      sources: context?.sources,
      canvas: context?.canvas,
      videoId,
    });

    let share: ShareRecord | undefined;
    try {
      const shareRes = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl,
          videoId,
          recipientName,
          profile: context?.profile,
          sources: context?.sources,
          canvas: context?.canvas,
          trace,
        }),
      });

      if (shareRes.ok) {
        const shareData = await shareRes.json();
        share = shareData.record;
      }
    } catch {
      // Sharing is non-critical; keep the completed video visible.
    }

    setState((prev) => ({
      ...prev,
      stage: "done",
      videoUrl,
      videoId,
      share,
      trace,
    }));
  } catch (error) {
    setState((prev) => ({
      ...prev,
      stage: "error",
      error:
        error instanceof Error ? error.message : "Video render failed",
    }));
  }
}
