import type { Profile } from "@/lib/claude";

export interface StepState {
  id: string;
  label: string;
  status: "pending" | "active" | "complete" | "failed";
  elapsed?: number;
}

export interface PipelineState {
  stage: "input" | "progress" | "review" | "done" | "error";
  steps: StepState[];
  profile?: Profile;
  script?: string;
  sources?: string[];
  assetUrls?: string[];
  videoUrl?: string;
  error?: string;
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
 * Run the full nuncio pipeline: enrich → script → canvas → video
 * Updates state at each step so the UI can show progress.
 */
export async function generateVideo(
  urls: string[],
  setState: SetState,
  senderBrief?: string
) {
  setState({
    stage: "progress",
    steps: INITIAL_STEPS.map((s, i) => ({
      ...s,
      status: i === 0 ? "active" : "pending",
    })),
  });

  try {
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

    updateStep(setState, "enrich", {
      status: "complete",
      elapsed: (Date.now() - enrichStart) / 1000,
    });
    updateStep(setState, "script", { status: "active" });

    // Stage 2: Script generation
    const scriptStart = Date.now();
    const scriptRes = await fetch("/api/script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrichment: enrichedMarkdown, senderBrief }),
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
    if (canvasRes.ok) {
      const canvasData = await canvasRes.json();
      assetUrls = canvasData.assetUrls || [];
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
      sources,
      assetUrls,
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
 * Called from the ScriptReview component.
 */
export async function renderVideo(
  script: string,
  assetUrls: string[],
  setState: SetState
) {
  updateStep(setState, "video", { status: "active" });
  setState((prev) => ({ ...prev, stage: "progress" }));

  try {
    const videoStart = Date.now();
    const videoRes = await fetch("/api/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script, assetUrls }),
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

    setState((prev) => ({
      ...prev,
      stage: "done",
      videoUrl,
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
