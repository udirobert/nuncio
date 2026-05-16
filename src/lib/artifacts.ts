import type { Profile } from "@/lib/claude";

export interface AgentTraceItem {
  label: string;
  detail: string;
  status?: "complete" | "warning" | "pending";
}

export interface CanvasProof {
  canvasId: string;
  provider: string;
  assetCount: number;
  canvasUrl?: string;
  exportUrl?: string;
}

export interface ShareRecord {
  id: string;
  videoUrl?: string;
  videoId?: string;
  recipientName?: string;
  senderName?: string;
  createdAt: string;
  profile?: Profile;
  sources?: string[];
  canvas?: CanvasProof;
  trace?: AgentTraceItem[];
  proof?: {
    provider: string;
    uri?: string;
    gatewayUrl?: string;
    storageKey?: string;
  } | null;
}

export function buildAgentTrace(input: {
  profile?: Profile;
  sources?: string[];
  senderBrief?: string;
  canvas?: CanvasProof;
  videoId?: string;
}): AgentTraceItem[] {
  const { profile, sources = [], senderBrief, canvas, videoId } = input;
  const trace: AgentTraceItem[] = [];

  if (sources.length > 0) {
    trace.push({
      label: "Enriched public context",
      detail: `${sources.length} source${sources.length === 1 ? "" : "s"} fetched: ${sources
        .map((source) => hostLabel(source))
        .join(", ")}`,
      status: "complete",
    });
  }

  if (profile) {
    const role = [profile.current_role, profile.company && `at ${profile.company}`]
      .filter(Boolean)
      .join(" ");
    trace.push({
      label: "Synthesised recipient profile",
      detail: `${profile.name}${role ? ` — ${role}` : ""}`,
      status: "complete",
    });

    const hooks = profile.personalization_hooks || [];
    trace.push({
      label: "Selected personalization hooks",
      detail:
        hooks.length > 0
          ? hooks.slice(0, 3).join(" · ")
          : "No explicit hooks detected; script uses general profile context",
      status: hooks.length > 0 ? "complete" : "warning",
    });

    trace.push({
      label: "Chose delivery tone",
      detail: `${profile.tone || "conversational"}${senderBrief ? " with sender brief constraints" : " from profile context"}`,
      status: "complete",
    });
  }

  if (canvas) {
    const generatedAssets = canvas.assetCount > 0;
    trace.push({
      label:
        canvas.provider === "melius"
          ? "Created Melius creative canvas"
          : canvas.provider === "fal"
            ? "Generated Fal creative assets"
            : "Created local creative session",
      detail: `${canvas.assetCount} generated asset${canvas.assetCount === 1 ? "" : "s"}${canvas.canvasUrl ? " with persistent canvas URL" : ""}`,
      status: canvas.provider === "melius" || generatedAssets ? "complete" : "warning",
    });
  }

  if (videoId) {
    trace.push({
      label: "Rendered HeyGen video",
      detail: `Video job ${videoId} completed and is ready to share`,
      status: "complete",
    });
  }

  return trace;
}

export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}