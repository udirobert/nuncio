/**
 * Analytics event tracking for nuncio.
 * Uses PostHog for product analytics.
 *
 * Events tracked:
 * - Funnel: form_submitted → enrichment_complete → script_reviewed → video_rendered → video_shared
 * - Engagement: playbook_viewed, example_clicked, intent_selected, voice_input_used
 * - Quality: enrichment_partial_failure, script_edited, translation_requested
 */

import posthog from "posthog-js";

function isReady(): boolean {
  return typeof window !== "undefined" && posthog.__loaded;
}

// ─── Funnel events ───────────────────────────────────────────────────────────

export function trackFormSubmitted(props: {
  urlCount: number;
  platforms: string[];
  hasBrief: boolean;
  intent: string | null;
  isDemo: boolean;
}) {
  if (!isReady()) return;
  posthog.capture("form_submitted", props);
}

export function trackEnrichmentComplete(props: {
  urlCount: number;
  successCount: number;
  failedUrls: string[];
  durationMs: number;
}) {
  if (!isReady()) return;
  posthog.capture("enrichment_complete", props);
}

export function trackScriptReviewed(props: {
  recipientName: string;
  wordCount: number;
  personalizationHooks: number;
  wasEdited: boolean;
}) {
  if (!isReady()) return;
  posthog.capture("script_reviewed", props);
}

export function trackVideoRendered(props: {
  recipientName: string;
  durationMs: number;
  provider: string;
}) {
  if (!isReady()) return;
  posthog.capture("video_rendered", props);
}

export function trackVideoShared(props: {
  method: "copy_link" | "download" | "twitter" | "linkedin";
  recipientName?: string;
}) {
  if (!isReady()) return;
  posthog.capture("video_shared", props);
}

// ─── Engagement events ───────────────────────────────────────────────────────

export function trackPlaybookViewed(props: {
  entryId?: string;
}) {
  if (!isReady()) return;
  posthog.capture("playbook_viewed", props);
}

export function trackExampleClicked(props: {
  exampleName: string;
  source: "home" | "playbook";
}) {
  if (!isReady()) return;
  posthog.capture("example_clicked", props);
}

export function trackIntentSelected(props: {
  intent: string;
}) {
  if (!isReady()) return;
  posthog.capture("intent_selected", props);
}

export function trackVoiceInputUsed(props: {
  durationSeconds: number;
  transcriptLength: number;
}) {
  if (!isReady()) return;
  posthog.capture("voice_input_used", props);
}

// ─── Quality events ──────────────────────────────────────────────────────────

export function trackEnrichmentPartialFailure(props: {
  failedUrl: string;
  reason: string;
}) {
  if (!isReady()) return;
  posthog.capture("enrichment_partial_failure", props);
}

export function trackScriptEdited(props: {
  originalWordCount: number;
  editedWordCount: number;
}) {
  if (!isReady()) return;
  posthog.capture("script_edited", props);
}

export function trackTranslationRequested(props: {
  targetLanguage: string;
}) {
  if (!isReady()) return;
  posthog.capture("translation_requested", props);
}

export function trackCaptionsGenerated() {
  if (!isReady()) return;
  posthog.capture("captions_generated");
}
