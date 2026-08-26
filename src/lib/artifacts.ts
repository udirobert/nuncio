import type { Profile } from "@/lib/claude";

export interface AgentTraceItem {
  label: string;
  detail: string;
  status?: "complete" | "warning" | "pending";
}

/** Orchestration provenance captured during generation. */
export interface GenerationProvenance {
  /** Content hashes for generated assets, keyed by role (video, soundscape, entrance, thumbnail). */
  hashes?: Record<string, string>;
  /** Genblaze manifest URIs, keyed by role. */
  manifests?: Record<string, string>;
  /** Canonical Genblaze manifest hashes, keyed by role. */
  manifestHashes?: Record<string, string>;
  /** Models / providers used during generation. */
  models?: Record<string, string>;
}

export interface ShareRecord {
  id: string;
  videoUrl?: string;
  videoId?: string;
  recipientName?: string;
  senderName?: string;
  /** Internal sender identity used for pilot allowlisting; never expose from public share GET responses. */
  senderEmail?: string;
  email?: string;
  workspaceId?: string;
  createdAt: string;
  profile?: Profile;
  sources?: string[];
  trace?: AgentTraceItem[];
  proof?: {
    provider: string;
    uri?: string;
    gatewayUrl?: string;
    storageKey?: string;
  } | null;
  privacy?: "public" | "private";
  plan?: "free" | "pro";
  industry?: string;
  videoStyle?: string;
  soundscapeUrl?: string;
  cinematicEntranceUrl?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  language?: string;
  /** Delivery mode for this share: recorded video or live avatar link. */
  deliveryMode?: "video" | "livelink";
  /** Snapshot of the sender's scheduling link — the booking CTA on /live and /v pages. */
  bookingUrl?: string;
  /** Custom thumbnail generated via GMI Cloud through Genblaze. */
  thumbnailUrl?: string;
  /** Generation provenance (Genblaze manifests, content hashes, models used). */
  generation?: GenerationProvenance;
}

export function buildAgentTrace(input: {
  profile?: Profile;
  sources?: string[];
  senderBrief?: string;
  videoId?: string;
}): AgentTraceItem[] {
  const { profile, sources = [], senderBrief, videoId } = input;
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
