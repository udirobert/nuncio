/**
 * Analytics event tracking for nuncio.
 * Uses PostHog for product analytics.
 *
 * Events tracked:
 * - Funnel: form_submitted → enrichment_complete → script_reviewed → video_rendered → video_shared
 * - Engagement: playbook_viewed, example_clicked, intent_selected, voice_input_used
 * - Quality: enrichment_partial_failure, script_edited, translation_requested
 * - LiveLink: live_session_requested, live_session_connected, live_session_ended, live_session_failed
 * - Scoreboard (STRATEGY Phase 1): booking_clicked, video_watch_through
 * - Viral loop (STRATEGY S6): viral_cta_clicked, viral_landing
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

// ─── LiveLink experiment ─────────────────────────────────────────────────────

export function trackLiveSessionRequested(props: { shareId: string }) {
  if (!isReady()) return;
  posthog.capture("live_session_requested", props);
}

export function trackLiveSessionConnected(props: { shareId: string }) {
  if (!isReady()) return;
  posthog.capture("live_session_connected", props);
}

export function trackLiveSessionEnded(props: {
  shareId: string;
  durationMs: number;
  reason: "manual" | "provider_closed" | "max_duration" | "unload";
  /** STRATEGY Phase 1 scoreboard instrumentation. */
  userTurns?: number;
  agentTurns?: number;
  questionTopics?: string[];
  bookingClicked?: boolean;
}) {
  if (!isReady()) return;
  posthog.capture("live_session_ended", props);
}

export function trackLiveSessionFailed(props: {
  shareId: string;
  reason: string;
}) {
  if (!isReady()) return;
  posthog.capture("live_session_failed", props);
}

/** Booking intent — the scoreboard's north star (meetings booked per artifact). */
export function trackBookingClicked(props: {
  shareId: string;
  surface: "live_page" | "share_page";
}) {
  if (!isReady()) return;
  posthog.capture("booking_clicked", props);
}

/** Recorded-video watch-through — the control-arm metric for prediction (b). */
export function trackVideoWatchThrough(props: { shareId: string }) {
  if (!isReady()) return;
  posthog.capture("video_watch_through", props);
}

// ─── Recipient → sender viral loop (STRATEGY S6) ─────────────────────────────

export function trackViralCtaClicked(props: {
  shareId?: string;
  ref: string;
  surface: "share_page" | "live_page" | "header";
}) {
  if (!isReady()) return;
  posthog.capture("viral_cta_clicked", props);
}

export function trackViralLanding(props: { ref: string }) {
  if (!isReady()) return;
  posthog.capture("viral_landing", props);
}

// ─── Wait screen engagement ─────────────────────────────────────────────────

export function trackWaitScreenComposerOpened() {
  if (!isReady()) return;
  posthog.capture("wait_composer_opened");
}

export function trackWaitScreenDraftSaved(props: {
  channel: string;
  usedAiSuggestion: boolean;
}) {
  if (!isReady()) return;
  posthog.capture("wait_draft_saved", props);
}

export function trackWaitScreenQuizOpened() {
  if (!isReady()) return;
  posthog.capture("wait_quiz_opened");
}

export function trackWaitScreenAiDraftGenerated(props: {
  channel: string;
  accepted: boolean;
}) {
  if (!isReady()) return;
  posthog.capture("wait_ai_draft_generated", props);
}
