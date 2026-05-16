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
  captions?: { text: string; startTime: number; endTime: number }[];
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
    const trace = buildAgentTrace({ profile, senderBrief: enhancedBrief, canvas });

    // Create share record early (before video renders) so user can view it during render
    // Default to public (free tier), pro users can toggle to private
    let earlyShare: ShareRecord | undefined;
    try {
      const shareRes = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: "",
          recipientName: profile?.name,
          profile,
          canvas,
          trace,
          privacy: "public",
          industry: detectIndustry(profile),
        }),
      });
      if (shareRes.ok) {
        const shareData = await shareRes.json();
        earlyShare = shareData.record;
      }
    } catch {
      // Sharing is non-critical - continue without share
    }

    setState((prev) => ({
      ...prev,
      stage: "review",
      profile,
      script,
      assetUrls,
      canvas,
      trace,
      share: earlyShare,
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
    share?: ShareRecord;
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
        // If we already have a share from early creation, update it; otherwise create new
        if (context?.share?.id) {
          const updateRes = await fetch(`/api/share/${context.share.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videoUrl: DEMO_VIDEO_URL,
              videoId: "demo-video",
              trace,
            }),
          });
          if (updateRes.ok) {
            share = await updateRes.json();
          }
        } else {
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
      let message = "Failed to start video render";
      try {
        const data = await videoRes.json();
        if (data?.error) message = data.error;
      } catch {
        // Fall back to generic message below.
      }
      throw new Error(message);
    }

    const { videoId } = await videoRes.json();

    // Push videoId to URL so user can resume if they refresh
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("rendering", videoId);
      window.history.replaceState({}, "", url.toString());
    }

    // Poll for completion
    let videoUrl: string | undefined;
    while (!videoUrl) {
      await new Promise((r) => setTimeout(r, 5000));

      let statusRes: Response;
      try {
        statusRes = await fetch(`/api/video/${videoId}`);
      } catch {
        throw new Error("Lost connection while checking video status. Your render may still be running — try again in a moment.");
      }

      let status: {
        status?: string;
        videoUrl?: string;
        failureMessage?: string;
        error?: string;
      };

      try {
        status = await statusRes.json();
      } catch {
        throw new Error("Received an invalid response while checking video status.");
      }

      if (!statusRes.ok) {
        throw new Error(status.error || "Failed to check video status.");
      }

      if (status.status === "completed") {
        videoUrl = status.videoUrl;
      } else if (status.status === "failed") {
        throw new Error(status.failureMessage || status.error || "Video generation failed");
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

    // Persist video to Grove for permanent URL (non-blocking on failure)
    let permanentVideoUrl = videoUrl;
    try {
      const persistRes = await fetch("/api/persist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl }),
      });
      if (persistRes.ok) {
        const { permanentUrl } = await persistRes.json();
        if (permanentUrl) permanentVideoUrl = permanentUrl;
      }
    } catch {
      // Grove persistence is non-critical — fall back to HeyGen URL
    }

    let share: ShareRecord | undefined;
    try {
      // If we already have a share from early creation, update it; otherwise create new
      if (context?.share?.id) {
        const updateRes = await fetch(`/api/share/${context.share.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoUrl: permanentVideoUrl,
            videoId,
            trace,
          }),
        });
        if (updateRes.ok) {
          share = await updateRes.json();
        }
      } else {
        const shareRes = await fetch("/api/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoUrl: permanentVideoUrl,
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
      }
    } catch {
      // Sharing is non-critical; keep the completed video visible.
    }

    setState((prev) => ({
      ...prev,
      stage: "done",
      videoUrl: permanentVideoUrl,
      videoId,
      share,
      trace,
    }));

    // Auto-generate captions via Speechmatics (non-blocking, updates state when ready)
    try {
      const captionsRes = await fetch("/api/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: permanentVideoUrl }),
      });
      if (captionsRes.ok) {
        const { captions } = await captionsRes.json();
        if (captions && captions.length > 0) {
          setState((prev) => ({ ...prev, captions }));
        }
      }
    } catch {
      // Captions are non-critical
    }
  } catch (error) {
    setState((prev) => ({
      ...prev,
      stage: "error",
      error:
        error instanceof Error ? error.message : "Video render failed",
    }));
  }
}

/**
 * Detect industry from profile to help differentiate video styles.
 */
function detectIndustry(profile?: Profile): string {
  if (!profile) return "general";

  const text = [
    profile.current_role || "",
    profile.company || "",
    ...(profile.interests || []),
    ...(profile.notable_work || []),
  ]
    .join(" ")
    .toLowerCase();

  const patterns: [string, RegExp][] = [
    ["food", /food|restaurant|chef|catering|bakery|culinary|menu|dining|foodtech|meal/],
    ["fitness", /fitness|gym|personal trainer|athlete|sports|wellness|health|training|movement|performance/],
    ["construction", /construction|builder|landscape|contractor|renovation|architecture|design|real estate|property|develop/],
    ["tech", /software|developer|engineer|ai|ml|data|startup|tech|saas|product|engineering|cto|vp engineering/],
    ["finance", /finance|bank|investment|accounting|fintech|wealth|cfo|controller|financial/],
    ["healthcare", /doctor|medical|health|nurse|hospital|pharma|biotech|clinical|healthcare|therapist/],
    ["education", /teacher|professor|school|university|education|training|learning|coach|mentor/],
    ["marketing", /marketing|brand|content|social media|creative|agency|growth|seo|communications|pr/],
    ["sales", /sales|business development|account executive|revenue|partnerships|bd|saas sales|account manager/],
    ["retail", /retail|store|shop|ecommerce|merchandise|buyer|brand manager|wholesale/],
  ];

  for (const [industry, regex] of patterns) {
    if (regex.test(text)) return industry;
  }

  return "general";
}
