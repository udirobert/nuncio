"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { FormEvent, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { LottieIcon } from "@/components/lottie-icon";
import type { VideoCustomization, HeyGenAvatar, HeyGenVoice } from "@/lib/heygen";
import { VideoCustomization as VideoCustomizationComponent } from "@/components/video-customization";
import { OnboardingModal } from "@/components/onboarding-modal";
import { LANGUAGES } from "@/lib/languages";
import { QuickProgress } from "./quick-progress";
import type { QuickProgressStep } from "./quick-progress";
import { CollaborativeSession } from "./collaborative-session";
import type { BandEvent } from "./collaborative-session";
import { VoiceOverlay } from "@/components/voice-overlay";
import type { VoiceProfileResult } from "@/components/voice-overlay";
import { DeepResearchToggle } from "@/components/deep-research-toggle";
import { QualityLadder } from "@/components/quality-ladder";
import type { UserPlan } from "@/components/quality-ladder";
import { trackReconnectCardCreated, trackReconnectCardSent } from "@/lib/analytics";

export type StudioStage = "input" | "enriching" | "collaborating" | "generating" | "review" | "building" | "ready" | "error";
export type ArchetypeSelection = "auto" | "mirror" | "origin" | "future_cast" | "inside_joke" | "day_in_the_life";
type CaptureIntent = "share" | "download" | "render" | "saveBrief";

const INTENT_META: Record<CaptureIntent, {
  icon: ReactNode;
  label: string;
  chipClass: string;
  iconClass: string;
}> = {
  render: {
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
        <path d="M8 5v14l11-7z" />
      </svg>
    ),
    label: "Render video",
    chipClass: "bg-accent-soft border-accent/20 text-accent",
    iconClass: "bg-accent text-white",
  },
  download: {
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
    label: "Download video",
    chipClass: "bg-warm-soft border-warm/20 text-warm",
    iconClass: "bg-warm text-white",
  },
  share: {
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
    ),
    label: "Share video",
    chipClass: "bg-success-soft border-success/20 text-success",
    iconClass: "bg-success text-white",
  },
  saveBrief: {
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    ),
    label: "Save brief",
    chipClass: "bg-accent-soft border-accent/20 text-accent",
    iconClass: "bg-accent text-white",
  },
};

const ARCHETYPE_OPTIONS: { id: ArchetypeSelection; label: string; description: string }[] = [
  { id: "auto", label: "Let agent pick", description: "AI chooses the best hook based on the recipient's profile signals." },
  { id: "mirror", label: "Mirror", description: "Reflect the recipient's own content back at them — their posts, work, or public statements." },
  { id: "origin", label: "Origin", description: "Show how their work started or what influenced their trajectory." },
  { id: "future_cast", label: "Future-cast", description: "Imagine a near-future world their current work enables." },
  { id: "inside_joke", label: "Inside joke", description: "Reference a specific detail only they'd recognise — warm and personal." },
  { id: "day_in_the_life", label: "Day-in-life", description: "A vignette of their daily workflow or creative process." },
];

// ─────────────────────────────────────────────────────────────────────────────
// Studio Client Props
// ─────────────────────────────────────────────────────────────────────────────

interface StudioClientProps {
  initialAvatars?: HeyGenAvatar[];
  initialVoices?: HeyGenVoice[];
  liveLinkEnabled: boolean;
}

function friendlyError(raw: string): { title: string; detail: string; tip?: string } {
  const lower = raw.toLowerCase();
  if (lower.includes("403") || lower.includes("login wall") || lower.includes("could not access")) {
    return {
      title: "Couldn't access this profile",
      detail: "Some platforms block automated access. This isn't your fault.",
      tip: "Try a LinkedIn profile, personal website, or blog URL instead.",
    };
  }
  if (lower.includes("not enough") || lower.includes("insufficient credits")) {
    return {
      title: "Not enough credits",
      detail: raw,
      tip: "Top up your credits to continue building videos.",
    };
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return {
      title: "Taking longer than expected",
      detail: "The research or render step timed out. This sometimes happens with complex profiles.",
      tip: "Try again — it may succeed on the next attempt, or try a simpler profile URL.",
    };
  }
  if (lower.includes("no response") || lower.includes("network") || lower.includes("fetch")) {
    return {
      title: "Connection problem",
      detail: "We couldn't reach the server. Check your internet connection.",
      tip: "If the problem persists, try refreshing the page.",
    };
  }
  if (lower.includes("could not identify") || lower.includes("not a person")) {
    return {
      title: "Couldn't identify a person",
      detail: "The URL doesn't seem to point to an individual's profile.",
      tip: "Try a LinkedIn profile, Twitter/X handle, or personal website.",
    };
  }
  return {
    title: "Something went wrong",
    detail: raw,
    tip: "Try again, or start over with a different profile.",
  };
}

function StudioClient({ initialAvatars, initialVoices, liveLinkEnabled }: StudioClientProps) {
  const [showProgressDetails, setShowProgressDetails] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showAdvancedInput, setShowAdvancedInput] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [showVoiceCard, setShowVoiceCard] = useState(false);
  const [scriptEditing, setScriptEditing] = useState(false);
  const [url, setUrl] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("nuncio_studio_bridge");
        if (stored) {
          const data = JSON.parse(stored);
          return data.url || "";
        }
      } catch { /* ignore */ }
    }
    return "";
  });
  const [senderName, setSenderName] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("nuncio_sender_name") || "";
    return "";
  });
  const [senderBrief, setSenderBrief] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("nuncio_studio_bridge");
        if (stored) {
          const data = JSON.parse(stored);
          return data.brief || "";
        }
      } catch { /* ignore */ }
    }
    return "";
  });
  const [personalMemory, setPersonalMemory] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("nuncio_studio_bridge");
        if (stored) {
          const data = JSON.parse(stored);
          return data.personalMemory || "";
        }
      } catch { /* ignore */ }
    }
    return "";
  });
  const [senderBusiness, setSenderBusiness] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("nuncio_sender_business") || "";
    return "";
  });
  const [senderBrand, setSenderBrand] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("nuncio_sender_brand") || "";
    return "";
  });
  const [senderPersonality, setSenderPersonality] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("nuncio_sender_personality") || "";
    return "";
  });
  const [senderAudience, setSenderAudience] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("nuncio_sender_audience") || "";
    return "";
  });
  const [senderOffer, setSenderOffer] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("nuncio_sender_offer") || "";
    return "";
  });
  const [senderProofPoints, setSenderProofPoints] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("nuncio_sender_proof_points") || "";
    return "";
  });
  const [outreachGoal, setOutreachGoal] = useState("");
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [reasonForReachingOutNow, setReasonForReachingOutNow] = useState("");
  const [relationshipWarmth, setRelationshipWarmth] = useState<"cold" | "warm" | "existing">("cold");
  const [tonePreference, setTonePreference] = useState("");
  const initialIsReconnect = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "reconnect";
  const initialDeliveryMode: "video" | "livelink" = (() => {
    if (initialIsReconnect) return "video";
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("nuncio_delivery_mode");
      if (stored === "video" || (stored === "livelink" && liveLinkEnabled)) return stored as "video" | "livelink";
    }
    return liveLinkEnabled ? "livelink" : "video";
  })();

  const [deliveryMode, setDeliveryMode] = useState<"video" | "livelink">(initialDeliveryMode);
  const [enableLiveTwin, setEnableLiveTwin] = useState(() => initialDeliveryMode === "livelink" && !initialIsReconnect);

  const [playbookOffer, setPlaybookOffer] = useState("");
  const [playbookWants, setPlaybookWants] = useState("");
  const [playbookWiggleRoom, setPlaybookWiggleRoom] = useState("");
  const [playbookConstraints, setPlaybookConstraints] = useState("");
  const [bookingUrl, setBookingUrl] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("nuncio_booking_url") || "";
    return "";
  });
  const [stage, setStage] = useState<StudioStage>("input");
  const [buildResult, setBuildResult] = useState<{ soundscapeUrl?: string; cinematicEntranceUrl?: string; recommendedVibeId?: string } | null>(null);
  const [error, setError] = useState("");
  const [purchasedPlan, setPurchasedPlan] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const plan = params.get("purchased");
    if (plan) {
      params.delete("purchased");
      const cleanUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);
    }
    return plan;
  });
  const [archetype, setArchetype] = useState<ArchetypeSelection>("auto");
  const [capturedEmail, setCapturedEmail] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [captureIntent, setCaptureIntent] = useState<CaptureIntent | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [detectingLanguage, setDetectingLanguage] = useState(false);
  const [translateEnabled, setTranslateEnabled] = useState(false);
  const [voiceOverlayOpen, setVoiceOverlayOpen] = useState(false);
  const [voiceOverlayMode, setVoiceOverlayMode] = useState<"campaign" | "playbook">("campaign");
  const [voiceBrief, setVoiceBrief] = useState<VoiceProfileResult | null>(null);
  const [pipelineStep, setPipelineStep] = useState<"idle" | "enrich" | "synthesise" | "compose">("idle");
  const [voicePopulatedFields, setVoicePopulatedFields] = useState<Set<string>>(new Set());
  const [researchTier, setResearchTier] = useState<"quick" | "balanced" | "deep">("quick");
  const [deepResearchEnabled, setDeepResearchEnabled] = useState(false);
  const [userPlan, setUserPlan] = useState<UserPlan>("trial");
  const [session, setSession] = useState<{ authenticated: boolean; email?: string; balance?: number } | null>(null);
  const [captureEmail, setCaptureEmail] = useState("");
  const [captureHoneypot, setCaptureHoneypot] = useState("");
  const [captureError, setCaptureError] = useState("");
  const [captureLoading, setCaptureLoading] = useState(false);
  const [showHookReasoning, setShowHookReasoning] = useState(false);
  const [insufficientCredits, setInsufficientCredits] = useState<{ required: number; available: number } | null>(null);
  const [videoRendering, setVideoRendering] = useState<"idle" | "rendering" | "done" | "failed">("idle");
  const [buildStep, setBuildStep] = useState<QuickProgressStep>("enrich");
  const [buildStartedAt, setBuildStartedAt] = useState<number | null>(null);
  const [buildElapsedSeconds, setBuildElapsedSeconds] = useState(0);
  const [videoRenderResult, setVideoRenderResult] = useState<{ videoUrl: string; videoId: string } | null>(null);
  const [videoCustomization, setVideoCustomization] = useState<VideoCustomization | undefined>();
  const [showCustomization, setShowCustomization] = useState(() => initialDeliveryMode === "livelink" && !initialIsReconnect);
  const [bandSessionId, setBandSessionId] = useState<string | null>(null);
  const [bandEvents, setBandEvents] = useState<BandEvent[]>([]);
  const bandEventSourceRef = useRef<EventSource | null>(null);

  // Wait screen context
  const [recentActivity, setRecentActivity] = useState<string | undefined>();
  const [recentActivityPosts, setRecentActivityPosts] = useState<import("@/lib/tinyfish").ActivityPost[] | undefined>();
  const [researchQuality, setResearchQuality] = useState<import("@/lib/pipeline/steps").ResearchQuality | undefined>();
  const [draftMessage, setDraftMessage] = useState<{ channel: string; message: string } | null>(null);

  // Review stage state
  const [reviewProfile, setReviewProfile] = useState<import("@/lib/claude").Profile | null>(null);
  const [reviewScript, setReviewScript] = useState("");
  const [reviewScriptVariantA, setReviewScriptVariantA] = useState<string | null>(null);
  const [reviewScriptVariantB, setReviewScriptVariantB] = useState<string | null>(null);
  const [reviewSelectedVariant, setReviewSelectedVariant] = useState<"a" | "b">("a");
  const [reviewHook, setReviewHook] = useState<{ archetype: string; reasoning: string; concept: string; prompt: string; format: string; formatReasoning: string } | null>(null);
  const [reviewRegenerating, setReviewRegenerating] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const [audioMemoUrl, setAudioMemoUrl] = useState<string | null>(null);
  const [audioMemoLoading, setAudioMemoLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-dismiss toast after 6 seconds
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 6000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const searchParams = useSearchParams();
  const mode = searchParams?.get("mode") === "reconnect" ? "reconnect" : "outreach";

  useEffect(() => {
    // Remove the bridge once all initial state has been seeded.
    try { sessionStorage.removeItem("nuncio_studio_bridge"); } catch { /* ignore */ }
  }, []);

  const senderBriefRef = useRef(senderBrief);
  senderBriefRef.current = senderBrief;

  const sentTrackedRef = useRef(false);
  useEffect(() => {
    if (mode !== "reconnect" || sentTrackedRef.current || !shareUrl) return;
    const shareId = shareUrl.split("/").pop();
    if (shareId) {
      sentTrackedRef.current = true;
      trackReconnectCardSent({ shareId, deliveryMode });
    }
  }, [mode, shareUrl, deliveryMode]);

  useEffect(() => {
    if (stage !== "building" || !buildStartedAt) {
      return;
    }
    const interval = setInterval(() => {
      setBuildElapsedSeconds(Math.floor((Date.now() - buildStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [buildStartedAt, stage]);

  const purchasedPlanRef = useRef(purchasedPlan);
  purchasedPlanRef.current = purchasedPlan;
  useEffect(() => {
    // Auto-dismiss post-checkout toast
    if (purchasedPlanRef.current) {
      const timer = setTimeout(() => setPurchasedPlan(null), 6000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Re-fetch balance after Stripe purchase (webhook may take a few seconds)
  useEffect(() => {
    if (!purchasedPlan) return;
    let cancelled = false;
    const delays = [3000, 6000, 12000];
    async function pollBalance() {
      for (const delay of delays) {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, delay));
        if (cancelled) return;
        try {
          const res = await fetch("/api/account/session");
          const s = await res.json();
          if (s.authenticated && typeof s.balance === "number" && s.balance > 0) {
            setSession(s);
            return;
          }
        } catch { /* retry */ }
      }
    }
    pollBalance();
    return () => { cancelled = true; };
  }, [purchasedPlan]);  

  useEffect(() => {
    // Load auth session and sender memory from server
    fetch("/api/account/session")
      .then((r) => r.json())
      .then((s) => {
        setSession(s);
        if (s.authenticated && s.email) {
          setCapturedEmail(s.email);
        }
      })
      .catch(() => setSession({ authenticated: false }));

    fetch("/api/account/brief")
      .then((r) => r.json())
      .then((data) => {
        if (data.senderName && !localStorage.getItem("nuncio_sender_name")) {
          setSenderName(data.senderName);
        }
        if (data.senderBrief && !senderBriefRef.current) {
          setSenderBrief(data.senderBrief);
        }
        if (data.senderBusiness && !localStorage.getItem("nuncio_sender_business")) {
          setSenderBusiness(data.senderBusiness);
        }
        if (data.senderBrand && !localStorage.getItem("nuncio_sender_brand")) {
          setSenderBrand(data.senderBrand);
        }
        if (data.senderPersonality && !localStorage.getItem("nuncio_sender_personality")) {
          setSenderPersonality(data.senderPersonality);
        }
        if (data.senderAudience && !localStorage.getItem("nuncio_sender_audience")) {
          setSenderAudience(data.senderAudience);
        }
        if (data.senderOffer && !localStorage.getItem("nuncio_sender_offer")) {
          setSenderOffer(data.senderOffer);
        }
        if (data.senderProofPoints && !localStorage.getItem("nuncio_sender_proof_points")) {
          setSenderProofPoints(data.senderProofPoints);
        }
        if (data.playbookWants && !localStorage.getItem("nuncio_playbook_wants")) {
          setPlaybookWants(data.playbookWants);
        }
        if (data.playbookOffer && !localStorage.getItem("nuncio_playbook_offer")) {
          setPlaybookOffer(data.playbookOffer);
        }
        if (data.playbookWiggleRoom && !localStorage.getItem("nuncio_playbook_wiggle_room")) {
          setPlaybookWiggleRoom(data.playbookWiggleRoom);
        }
        if (data.playbookConstraints && !localStorage.getItem("nuncio_playbook_constraints")) {
          setPlaybookConstraints(data.playbookConstraints);
        }
        if (data.bookingUrl && !localStorage.getItem("nuncio_booking_url")) {
          setBookingUrl(data.bookingUrl);
          localStorage.setItem("nuncio_booking_url", data.bookingUrl);
        }
        if (data.anamAvatarId && !localStorage.getItem("nuncio_anam_avatar_id")) {
          localStorage.setItem("nuncio_anam_avatar_id", data.anamAvatarId);
        }
        if (data.anamVoiceId && !localStorage.getItem("nuncio_anam_voice_id")) {
          localStorage.setItem("nuncio_anam_voice_id", data.anamVoiceId);
        }
        if (
          !localStorage.getItem("nuncio_delivery_mode") &&
          (data.deliveryMode === "video" || (data.deliveryMode === "livelink" && liveLinkEnabled))
        ) {
          setDeliveryMode(data.deliveryMode);
        }
        if (data.plan) {
          setUserPlan(data.plan as UserPlan);
        }
      })
      .catch(() => {});
  }, [liveLinkEnabled, searchParams]);

  // Persist voice-captured profile to the server after it has been applied to form state
  useEffect(() => {
    if (!voiceBrief || !session?.authenticated) return;
    saveSenderMemory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceBrief, session?.authenticated]);

  // Auto-detect language from URL
  const urlRef = useRef(url);
  urlRef.current = url;
  useEffect(() => {
    const currentUrl = urlRef.current;
    if (!currentUrl.trim() || currentUrl.startsWith("__")) {
      setDetectedLanguage(null);
      return;
    }
    const timer = setTimeout(async () => {
      setDetectingLanguage(true);
      try {
        const res = await fetch("/api/studio/language-detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: currentUrl }),
        });
        if (res.ok) {
          const data = await res.json();
          if (urlRef.current === currentUrl) {
            setDetectedLanguage(data.language);
          }
        }
      } catch {
        if (urlRef.current === currentUrl) setDetectedLanguage(null);
      } finally {
        if (urlRef.current === currentUrl) setDetectingLanguage(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [url]);

  async function saveSenderMemory(overrides?: { deliveryMode?: "video" | "livelink" }) {
    const brief = senderBrief.trim();
    const name = senderName.trim();
    const business = senderBusiness.trim();
    const brand = senderBrand.trim();
    const personality = senderPersonality.trim();
    const audience = senderAudience.trim();
    const offer = senderOffer.trim();
    const proofPoints = senderProofPoints.trim();
    const playbookOfferValue = playbookOffer.trim();
    const playbookWantsValue = playbookWants.trim();
    const playbookWiggleRoomValue = playbookWiggleRoom.trim();
    const playbookConstraintsValue = playbookConstraints.trim();
    const bookingUrlValue = bookingUrl.trim();
    const mode = overrides?.deliveryMode ?? deliveryMode;
    const anamAvatarId = typeof window !== "undefined" ? localStorage.getItem("nuncio_anam_avatar_id") : null;
    const anamVoiceId = typeof window !== "undefined" ? localStorage.getItem("nuncio_anam_voice_id") : null;
    if (
      !brief && !name && !business && !brand && !personality && !audience && !offer && !proofPoints &&
      !playbookOfferValue && !playbookWantsValue && !playbookWiggleRoomValue && !playbookConstraintsValue &&
      !bookingUrlValue && !anamAvatarId && !anamVoiceId &&
      mode === "video"
    ) return;
    await fetch("/api/account/brief", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderBrief: brief || undefined,
        senderName: name || undefined,
        senderBusiness: business || undefined,
        senderBrand: brand || undefined,
        senderPersonality: personality || undefined,
        senderAudience: audience || undefined,
        senderOffer: offer || undefined,
        senderProofPoints: proofPoints || undefined,
        playbookOffer: playbookOfferValue || undefined,
        playbookWants: playbookWantsValue || undefined,
        playbookWiggleRoom: playbookWiggleRoomValue || undefined,
        playbookConstraints: playbookConstraintsValue || undefined,
        bookingUrl: bookingUrlValue || undefined,
        deliveryMode: mode,
        ...(anamAvatarId ? { anamAvatarId } : {}),
        ...(anamVoiceId ? { anamVoiceId } : {}),
      }),
    }).catch(() => {});
    if (name) localStorage.setItem("nuncio_sender_name", name);
    if (business) localStorage.setItem("nuncio_sender_business", business);
    if (brand) localStorage.setItem("nuncio_sender_brand", brand);
    if (personality) localStorage.setItem("nuncio_sender_personality", personality);
    if (audience) localStorage.setItem("nuncio_sender_audience", audience);
    if (offer) localStorage.setItem("nuncio_sender_offer", offer);
    if (proofPoints) localStorage.setItem("nuncio_sender_proof_points", proofPoints);
    if (playbookOfferValue) localStorage.setItem("nuncio_playbook_offer", playbookOfferValue);
    if (playbookWantsValue) localStorage.setItem("nuncio_playbook_wants", playbookWantsValue);
    if (playbookWiggleRoomValue) localStorage.setItem("nuncio_playbook_wiggle_room", playbookWiggleRoomValue);
    if (playbookConstraintsValue) localStorage.setItem("nuncio_playbook_constraints", playbookConstraintsValue);
    if (bookingUrlValue) localStorage.setItem("nuncio_booking_url", bookingUrlValue);
    localStorage.setItem("nuncio_delivery_mode", mode);
  }

  function handleDeliveryModeChange(newMode: "video" | "livelink") {
    if (newMode === "livelink" && !liveLinkEnabled) return;
    setDeliveryMode(newMode);
    setShowCustomization(newMode === "livelink");
    setEnableLiveTwin(newMode === "livelink" && mode === "outreach");
    saveSenderMemory({ deliveryMode: newMode });
  }

  function applyVoiceProfile(profile: VoiceProfileResult) {
    const populated = new Set<string>();
    if (profile.url) { setUrl(profile.url); populated.add("url"); }
    if (profile.name) { populated.add("name"); }
    if (profile.company) { populated.add("company"); }
    if (profile.role) { populated.add("role"); }
    if (profile.senderName) { setSenderName(profile.senderName); populated.add("senderName"); }
    if (profile.senderBrief) { setSenderBrief(profile.senderBrief); populated.add("senderBrief"); }
    if (profile.senderBusiness) { setSenderBusiness(profile.senderBusiness); populated.add("senderBusiness"); }
    if (profile.senderBrand) { setSenderBrand(profile.senderBrand); populated.add("senderBrand"); }
    if (profile.senderPersonality) { setSenderPersonality(profile.senderPersonality); populated.add("senderPersonality"); }
    if (profile.senderAudience) { setSenderAudience(profile.senderAudience); populated.add("senderAudience"); }
    if (profile.senderOffer) { setSenderOffer(profile.senderOffer); populated.add("senderOffer"); }
    if (profile.senderProofPoints) { setSenderProofPoints(profile.senderProofPoints.join("\n")); populated.add("senderProofPoints"); }
    if (profile.archetype) setArchetype(profile.archetype as ArchetypeSelection);
    if (profile.tone) setTonePreference(profile.tone);
    if (profile.offer) { setPlaybookOffer(profile.offer); populated.add("offer"); }
    if (profile.wants) { setPlaybookWants(profile.wants); populated.add("wants"); }
    if (profile.wiggleRoom) { setPlaybookWiggleRoom(profile.wiggleRoom); populated.add("wiggleRoom"); }
    if (profile.constraints) { setPlaybookConstraints(profile.constraints.join("\n")); populated.add("constraints"); }
    if (profile.bookingUrl) { setBookingUrl(profile.bookingUrl); populated.add("bookingUrl"); }
    setVoiceBrief(profile);
    setVoicePopulatedFields(populated);
    setVoiceOverlayOpen(false);
    setTimeout(() => setVoicePopulatedFields(new Set()), 3000);
    return populated;
  }

  function handleVoiceComplete(profile: VoiceProfileResult) {
    applyVoiceProfile(profile);
  }

  function handleVoiceRequestSave(profile: VoiceProfileResult) {
    // Apply the profile to the form and then ask for email so we can persist it server-side
    applyVoiceProfile(profile);
    setCaptureIntent("saveBrief" as CaptureIntent);
    setCaptureError("");
    setCaptureEmail("");
  }

  function validateUrl(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;
    try {
      const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      const host = parsed.hostname.replace(/^www\./, "");
      const knownProfiles = ["linkedin.com", "x.com", "twitter.com", "github.com", "instagram.com"];
      const isKnown = knownProfiles.some((p) => host === p || host.endsWith(`.${p}`));
      if (!isKnown && !trimmed.startsWith("http")) {
        return "This doesn't look like a URL. Try pasting a LinkedIn or Twitter profile link.";
      }
      if (!isKnown) {
        return "Tip: LinkedIn or Twitter profiles work best. Other URLs may have less data.";
      }
      return null;
    } catch {
      return "This doesn't look like a valid URL. Try pasting a LinkedIn or Twitter profile link.";
    }
  }

  async function handleEnrich(resumeFromSession?: string) {
    if (!url.trim()) return;
    const urlValidation = validateUrl(url);
    if (urlValidation && urlValidation.includes("doesn't look like a URL")) {
      setUrlError(urlValidation);
      return;
    }

    if (mode === "reconnect" && personalMemory.trim().length < 10) {
      setToastMessage("Add a short personal memory so the card feels like it's from you, not the internet.");
      return;
    }

    const demoAgents = typeof window !== "undefined" && (
      localStorage.getItem("nuncio_demo_agents") === "band" ||
      new URLSearchParams(window.location.search).get("agents") === "band"
    );

    // Demo mode: route to Band agents (hidden toggle for hackathon/live demos)
    if (demoAgents) {
      startBandSession();
      return;
    }

    // Unified pipeline: server-side agents emit activity events
    const sessionId = crypto.randomUUID();
    setBandSessionId(sessionId);
    setBandEvents([]);
    setStage("generating");
    setPipelineStep("enrich");
    setError("");
    setResearchQuality(undefined);
    saveSenderMemory();

    // Open SSE to activity store for the collaborative panel
    const es = new EventSource(`/api/band/activity?sessionId=${sessionId}`);
    bandEventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "heartbeat") return;
        setBandEvents((prev) => [...prev, data]);
      } catch { /* skip malformed */ }
    };

    es.onerror = () => {
      es.close();
      setTimeout(() => {
        if (bandEventSourceRef.current === es) {
          const newEs = new EventSource(`/api/band/activity?sessionId=${sessionId}`);
          bandEventSourceRef.current = newEs;
          newEs.onmessage = es.onmessage;
          newEs.onerror = es.onerror;
        }
      }, 3000);
    };

    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          sessionId,
          resumeSessionId: resumeFromSession,
          deliveryMode,
          mode,
          senderName: senderName.trim() || undefined,
          senderBrief: senderBrief.trim() || undefined,
          personalMemory: personalMemory.trim() || undefined,
          offer: playbookOffer.trim() || undefined,
          wants: playbookWants.trim() || undefined,
          wiggleRoom: playbookWiggleRoom.trim() || undefined,
          constraints: playbookConstraints
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean),
          senderBusiness: senderBusiness.trim() || undefined,
          senderBrand: senderBrand.trim() || undefined,
          senderPersonality: senderPersonality.trim() || undefined,
          senderAudience: senderAudience.trim() || undefined,
          senderOffer: senderOffer.trim() || undefined,
          senderProofPoints: senderProofPoints
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean),
          outreachGoal: outreachGoal.trim() || undefined,
          desiredOutcome: desiredOutcome.trim() || undefined,
          reasonForReachingOutNow: reasonForReachingOutNow.trim() || undefined,
          relationshipWarmth,
          tonePreference: tonePreference.trim() || undefined,
          archetype: archetype === "auto" ? undefined : archetype,
          scriptVariants: false,
          researchTier: researchTier !== "quick" ? researchTier : undefined,
          deepResearchEnabled: deepResearchEnabled || undefined,
          language: translateEnabled ? (detectedLanguage || undefined) : "en",
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        let msg = "Pipeline failed";
        try { const j = JSON.parse(body); msg = j.error || msg; } catch { /* */ }
        throw new Error(msg);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.phase) {
              setPipelineStep(event.phase);
              // Capture research quality warning as soon as it arrives,
              // before the script is even generated — so the user sees
              // the warning immediately if TinyFish is degraded.
              if (event.phase === "research_quality" && event.researchQuality) {
                setResearchQuality(event.researchQuality);
              }
            } else if (event.insufficientCredits) {
              setInsufficientCredits({ required: event.requiredCredits, available: event.availableCredits });
              throw new Error(event.error);
            } else if (event.error) {
              throw new Error(event.error);
            } else if (event.type === "done" || event.type === "ready") {
              const data = event.result;
              setReviewProfile(data.profile);
              setReviewScript(typeof data.script === "string" ? data.script : "");
              setReviewScriptVariantA(data.scriptVariantA || null);
              setReviewScriptVariantB(data.scriptVariantB || null);
              setReviewSelectedVariant("a");
              setReviewHook(data.hook);
              if (data.recentActivity) setRecentActivity(data.recentActivity);
              if (data.recentActivityPosts) setRecentActivityPosts(data.recentActivityPosts);
              if (data.researchQuality) setResearchQuality(data.researchQuality);
              if (typeof event.creditsBalance === "number") {
                setSession((prev) => prev ? { ...prev, balance: event.creditsBalance } : prev);
              }
              // If auto-rendered, store video result
              if (event.videoUrl) {
                setVideoRenderResult({ videoUrl: event.videoUrl, videoId: event.videoId });
                setVideoRendering("done");
              }
              setPipelineStep("idle");
              setStage("review");
            }
          } catch (err) {
            if (err instanceof Error && err.message !== "Unexpected end of JSON input") {
              throw err;
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pipeline failed");
      setPipelineStep("idle");
      setStage("error");
    } finally {
      bandEventSourceRef.current?.close();
      bandEventSourceRef.current = null;
    }
  }

  // ── Band collaborative session management ──────────────────────────────────

  function startBandSession() {
    const sessionId = crypto.randomUUID();
    setBandSessionId(sessionId);
    setBandEvents([]);
    setStage("collaborating");
    saveSenderMemory();

    // Post local kickoff event for immediate UI feedback
    fetch("/api/band/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        agent: "system",
        eventType: "message",
        content: `Session started. Creating Band room for: ${url.trim()}`,
        metadata: { url: url.trim(), senderBrief: senderBrief.trim() || undefined },
      }),
    }).catch(() => {});

    // Create Band room, add agents, post kickoff
    fetch("/api/band/room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: url.trim(),
        sessionId,
        senderBrief: senderBrief.trim() || undefined,
        senderName: senderName.trim() || undefined,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.roomUrl) {
          window.open(data.roomUrl, "_blank");
        }
        if (data.roomId) {
          fetch("/api/band/activity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              agent: "system",
              eventType: "message",
              content: `Band room created. Agents collaborating...`,
              metadata: { roomId: data.roomId },
            }),
          }).catch(() => {});
        }
      })
      .catch((err) => {
        fetch("/api/band/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            agent: "system",
            eventType: "error",
            content: `Failed to create Band room: ${err instanceof Error ? err.message : "unknown error"}`,
          }),
        }).catch(() => {});
      });

    // Open SSE connection
    const es = new EventSource(`/api/band/activity?sessionId=${sessionId}`);
    bandEventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "heartbeat") return;
        setBandEvents((prev) => [...prev, data]);

        // Detect producer completion
        if (
          data.eventType === "complete" &&
          data.agent === "producer" &&
          data.metadata?.script
        ) {
          handleBandComplete({
            script: data.metadata.script,
            profile: data.metadata.profile,
          });
        }
      } catch { /* skip malformed */ }
    };

    es.onerror = () => {
      es.close();
      setTimeout(() => {
        if (bandEventSourceRef.current === es) {
          const newEs = new EventSource(`/api/band/activity?sessionId=${sessionId}`);
          bandEventSourceRef.current = newEs;
          newEs.onmessage = es.onmessage;
          newEs.onerror = es.onerror;
        }
      }, 3000);
    };
  }

  function handleBandComplete(data: { script: string; profile?: Record<string, unknown> }) {
    // Close SSE
    bandEventSourceRef.current?.close();
    bandEventSourceRef.current = null;

    // Transition to review stage with the agent-generated script
    setReviewScript(data.script);
    if (data.profile) {
      setReviewProfile(data.profile as unknown as import("@/lib/claude").Profile);
    }
    setStage("review");
  }

  async function handleBandSendMessage(content: string) {
    if (!bandSessionId) return;
    // Post user message to activity store
    await fetch("/api/band/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: bandSessionId,
        agent: "user",
        eventType: "user_message",
        content,
      }),
    });
  }

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      bandEventSourceRef.current?.close();
    };
  }, []);

  // Resume pending render if user navigated away and came back
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem("nuncio_pending_render");
      if (!pending) return;
      const { videoId } = JSON.parse(pending) as { videoId: string; recipientName?: string; startedAt?: number };
      if (!videoId) return;

      let cancelled = false;
      const checkRenderStatus = async () => {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/video/${videoId}`);
          if (!res.ok) return;
          const status = await res.json();
          if (status.status === "completed" && status.videoUrl) {
            clearInterval(checkInterval);
            sessionStorage.removeItem("nuncio_pending_render");
            setVideoRenderResult({ videoUrl: status.videoUrl, videoId });
            setVideoRendering("done");
            if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
              new Notification("Your video is ready!", {
                body: "Your nuncio video has finished rendering.",
                icon: "/icon-192.png",
              });
            }
          } else if (status.status === "failed") {
            clearInterval(checkInterval);
            sessionStorage.removeItem("nuncio_pending_render");
            setVideoRendering("failed");
          }
        } catch { /* keep polling */ }
      };
      const checkInterval = setInterval(checkRenderStatus, 10000);
      // Check immediately
      checkRenderStatus();
      return () => { cancelled = true; clearInterval(checkInterval); };
    } catch { /* ignore */ }
  }, []);

  async function handleRegenerate(adjustments?: string) {
    if (!reviewProfile) return;
    setReviewRegenerating(true);
    setPipelineStep("compose");
    const baseTone = tonePreference.trim();
    const effectiveTone = adjustments
      ? [baseTone, adjustments].filter(Boolean).join(". Also: ")
      : baseTone;
    try {
      const res = await fetch("/api/studio/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          deliveryMode,
          mode,
          senderName: senderName.trim() || undefined,
          senderBrief: senderBrief.trim() || undefined,
          personalMemory: personalMemory.trim() || undefined,
          senderBusiness: senderBusiness.trim() || undefined,
          senderBrand: senderBrand.trim() || undefined,
          senderPersonality: senderPersonality.trim() || undefined,
          senderAudience: senderAudience.trim() || undefined,
          senderOffer: senderOffer.trim() || undefined,
          senderProofPoints: senderProofPoints
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean),
          offer: playbookOffer.trim() || undefined,
          wants: playbookWants.trim() || undefined,
          wiggleRoom: playbookWiggleRoom.trim() || undefined,
          constraints: playbookConstraints
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean),
          outreachGoal: outreachGoal.trim() || undefined,
          desiredOutcome: desiredOutcome.trim() || undefined,
          reasonForReachingOutNow: reasonForReachingOutNow.trim() || undefined,
          relationshipWarmth,
          tonePreference: effectiveTone || undefined,
          archetype: archetype === "auto" ? undefined : archetype,
          profile: reviewProfile,
          scriptVariants: false,
          language: translateEnabled ? (reviewProfile.language || undefined) : "en",
        }),
      });

      if (!res.ok) {
        setToastMessage("Couldn't regenerate script — your current script is still here. Try again or edit it manually.");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.phase) {
              setPipelineStep(event.phase);
            } else if (event.type === "done") {
              const data = event.result;
              setReviewScript(typeof data.script === "string" ? data.script : "");
              setReviewScriptVariantA(data.scriptVariantA || null);
              setReviewScriptVariantB(data.scriptVariantB || null);
              setReviewSelectedVariant("a");
              setReviewHook(data.hook);
              if (data.researchQuality) setResearchQuality(data.researchQuality);
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch {
      setToastMessage("Couldn't regenerate script — your current script is still here. Try again or edit it manually.");
    }
    setPipelineStep("idle");
    setReviewRegenerating(false);
  }

  async function handleTtsPreview() {
    // If already playing, stop
    if (ttsPlaying && ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
      setTtsPlaying(false);
      return;
    }

    // If we already have audio for this script, just play it
    if (ttsAudioUrl) {
      const audio = new Audio(ttsAudioUrl);
      audio.onended = () => setTtsPlaying(false);
      ttsAudioRef.current = audio;
      audio.play().catch(() => {});
      setTtsPlaying(true);
      return;
    }

    // Generate new TTS
    setTtsLoading(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reviewScript }),
      });
      if (res.ok) {
        const data = await res.json();
        setTtsAudioUrl(data.audio);
        const audio = new Audio(data.audio);
        audio.onended = () => setTtsPlaying(false);
        ttsAudioRef.current = audio;
        audio.play().catch(() => {});
        setTtsPlaying(true);
      } else {
        setToastMessage("Couldn't generate voice preview — the TTS service may be busy. You can still render the video.");
      }
    } catch {
      setToastMessage("Couldn't generate voice preview — the TTS service may be busy. You can still render the video.");
    }
    setTtsLoading(false);
  }

  async function handleAudioMemo() {
    if (audioMemoUrl) return; // Already generated
    if (!reviewProfile) return;
    setAudioMemoLoading(true);
    try {
      const name = reviewProfile.name || "there";
      const hook = reviewProfile.personalization_hooks?.[0] || reviewProfile.current_role || "";
      const memoText = `Hey ${name}, I just put together a quick personalised video for you${hook ? ` about ${hook}` : ""}. Check the link below — I think you'll find it relevant.`;
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: memoText }),
      });
      if (res.ok) {
        const data = await res.json();
        setAudioMemoUrl(data.audio);
      } else {
        setToastMessage("Couldn't generate audio memo — the TTS service may be busy.");
      }
    } catch {
      setToastMessage("Couldn't generate audio memo — the TTS service may be busy.");
    }
    setAudioMemoLoading(false);
  }

  async function handleConfirmBuild() {
    if (!reviewProfile || !reviewScript) return;
    if (!capturedEmail) {
      openCapture(deliveryMode === "livelink" ? "share" : "render");
      return;
    }
    if (mode === "reconnect") {
      trackReconnectCardCreated({
        recipientName: reviewProfile?.name,
        hasPersonalMemory: personalMemory.trim().length > 0,
        personalMemoryLength: personalMemory.trim().length,
        hasClonedVoice: typeof window !== "undefined" && Boolean(localStorage.getItem("nuncio_cloned_voice_id")),
        hasPhotoAvatar: typeof window !== "undefined" && Boolean(localStorage.getItem("nuncio_photo_avatar_id")),
        deliveryMode,
      });
    }
    await saveSenderMemory();
    setStage("building");
    setBuildStep("build");
    setBuildStartedAt(Date.now());
    setBuildElapsedSeconds(0);
    setShowHookReasoning(false);

    if (deliveryMode === "livelink") {
      const anamAvatarId = videoCustomization?.anamAvatarId;
      const anamVoiceId = videoCustomization?.anamVoiceId;
      const liveReady = anamAvatarId && anamVoiceId;
      if (!liveReady) {
        setToastMessage("Enable 'Train live twin' and upload a photo + voice sample before creating a live link.");
        setStage("review");
        return;
      }
      const liveLinkUrl = await handleCreateLiveLink();
      if (!liveLinkUrl) {
        setStage("error");
        return;
      }
      setBuildResult({});
      setStage("ready");
      return;
    }

    const rendered = await handleRenderVideo(capturedEmail);
    if (!rendered) {
      setStage("error");
      return;
    }
    setBuildResult({});
    setStage("ready");
  }

  async function handleCreateLiveLink(): Promise<string | null> {
    if (!reviewProfile) return null;
    const anamAvatarId = videoCustomization
      ? videoCustomization.anamAvatarId
      : (typeof window !== "undefined" ? localStorage.getItem("nuncio_anam_avatar_id") : null) || undefined;
    const anamVoiceId = videoCustomization
      ? videoCustomization.anamVoiceId
      : (typeof window !== "undefined" ? localStorage.getItem("nuncio_anam_voice_id") : null) || undefined;
    if (deliveryMode === "livelink" && videoCustomization && (!anamAvatarId || !anamVoiceId)) {
      setToastMessage("Enable 'Train live twin' and upload a photo + voice sample before creating a live link.");
      return null;
    }
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryMode: "livelink",
          mode,
          recipientName: reviewProfile.name,
          senderName: senderName.trim() || undefined,
          profile: reviewProfile,
          privacy: "private",
          anamAvatarId,
          anamVoiceId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not create live link");
      }

      const data = await res.json();
      const createdUrl = (data.shareUrl as string) || "";
      setShareUrl(createdUrl);
      return createdUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create live link");
      return null;
    }
  }

  function openCapture(intent: CaptureIntent) {
    setCaptureIntent(intent);
    setCaptureError("");
    setCaptureEmail(capturedEmail);
  }

  async function handleEmailCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setCaptureLoading(true);
    setCaptureError("");
    try {
      const anamAvatarId = typeof window !== "undefined" ? localStorage.getItem("nuncio_anam_avatar_id") : null;
      const anamVoiceId = typeof window !== "undefined" ? localStorage.getItem("nuncio_anam_voice_id") : null;
      const res = await fetch("/api/studio/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: captureEmail,
          honeypot: captureHoneypot,
          profile: reviewProfile,
          language: reviewProfile?.language || "en",
          soundscapeUrl: buildResult?.soundscapeUrl,
          cinematicEntranceUrl: buildResult?.cinematicEntranceUrl,
          ...(anamAvatarId ? { anamAvatarId } : {}),
          ...(anamVoiceId ? { anamVoiceId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not capture email");
      }

      setCapturedEmail(data.email);
      setShareUrl(data.shareUrl || "");
      setCaptureIntent(null);

      if (captureIntent === "share") {
        if (deliveryMode === "livelink" && !data.shareUrl) {
          const liveLinkUrl = await handleCreateLiveLink();
          if (liveLinkUrl) {
            setStage("ready");
            await copyShareUrl(liveLinkUrl);
          }
        } else if (data.shareUrl) {
          await copyShareUrl(data.shareUrl);
        }
      } else if (captureIntent === "download") {
        openDownloadTarget();
      } else if (captureIntent === "render") {
        await handleRenderVideo(data.email);
      } else if (captureIntent === "saveBrief") {
        // Fill studio from the voice brief that was captured
        if (voiceBrief) applyVoiceProfile(voiceBrief);
      }
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCaptureLoading(false);
    }
  }

  async function handleShareClick() {
    // If we already have the email but not the share URL, create the share directly without re-prompting
    if (capturedEmail && !shareUrl) {
      if (deliveryMode === "livelink" && reviewProfile) {
        const liveLinkUrl = await handleCreateLiveLink();
        if (liveLinkUrl) {
          await copyShareUrl(liveLinkUrl);
          setStage("ready");
        }
      } else {
        // For video mode, create the share record directly
        try {
          const res = await fetch("/api/share", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videoUrl: videoRenderResult?.videoUrl,
              videoId: videoRenderResult?.videoId,
              mode,
              recipientName: reviewProfile?.name,
              senderName: senderName.trim() || undefined,
              profile: reviewProfile || undefined,
              privacy: "private",
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.shareUrl) {
              setShareUrl(data.shareUrl);
              await copyShareUrl(data.shareUrl);
            }
          }
        } catch { /* ignore — will show error on next click */ }
      }
      return;
    }
    if (!capturedEmail) {
      openCapture("share");
      return;
    }
    if (shareUrl) {
      await copyShareUrl(shareUrl);
    }
  }

  async function handleRenderVideo(email = capturedEmail) {
    if (!reviewScript || videoRendering === "rendering") return false;
    if (!email) {
      openCapture("render");
      return false;
    }

    const recipientName = reviewProfile?.name;

    setVideoRendering("rendering");
    setCaptureIntent(null);
    setBuildStep("render");

    // Request notification permission so we can ping users who tab away
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    try {
      const res = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: reviewScript,
          recipientName,
          customization: videoCustomization,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start video render");
      }

      const { videoId } = await res.json();

      // Persist render job so user can navigate away and resume
      try {
        sessionStorage.setItem("nuncio_pending_render", JSON.stringify({ videoId, recipientName: recipientName || "", startedAt: Date.now() }));
      } catch { /* ignore */ }

      let videoUrl: string | undefined;
      let attempts = 0;
      const MAX_ATTEMPTS = 60;
      while (!videoUrl && attempts < MAX_ATTEMPTS) {
        attempts++;
        await new Promise((r) => setTimeout(r, 5000));

        const statusRes = await fetch(`/api/video/${videoId}`);
        if (!statusRes.ok) continue;

        const status = await statusRes.json();
        if (status.status === "completed") {
          videoUrl = status.videoUrl;
        } else if (status.status === "failed") {
          throw new Error(status.failureMessage || "Video generation failed");
        }
      }
      if (!videoUrl) {
        // Don't throw — keep the job alive in sessionStorage so user can check later
        try { sessionStorage.removeItem("nuncio_pending_render"); } catch { /* ignore */ }
        throw new Error("Video render timed out — it may still be running. Check your dashboard in a few minutes.");
      }

      // Clear pending render
      try { sessionStorage.removeItem("nuncio_pending_render"); } catch { /* ignore */ }

      setVideoRenderResult({ videoUrl, videoId });
      setVideoRendering("done");

      // Create/update share record with video URL for dashboard
      fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl,
          videoId,
          mode,
          recipientName: reviewProfile?.name,
          senderName: senderName.trim() || undefined,
          profile: reviewProfile || undefined,
          privacy: "private",
        }),
      }).catch(() => {});

      // Flash document title for tabbed-away users
      const originalTitle = document.title;
      document.title = "✅ Video ready! — Nuncio";
      const titleTimer = setInterval(() => {
        document.title = document.title === originalTitle ? "✅ Video ready! — Nuncio" : originalTitle;
      }, 1500);
      const stopFlash = () => { clearInterval(titleTimer); document.title = originalTitle; };
      window.addEventListener("focus", stopFlash, { once: true });
      setTimeout(stopFlash, 30000);

      // Notify user if they tabbed away
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
        new Notification("Your video is ready!", {
          body: `Video for ${reviewProfile?.name || "your recipient"} has finished rendering.`,
          icon: "/icon-192.png",
        });
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Video render failed";
      setVideoRendering("failed");
      setCaptureError(message);
      setError(message);
      return false;
    }
  }

  async function copyShareUrl(path: string) {
    const absolute = new URL(path, window.location.origin).toString();
    await navigator.clipboard?.writeText(absolute);
  }

  function openDownloadTarget() {
    if (videoRenderResult?.videoUrl) {
      window.open(videoRenderResult.videoUrl, "_blank", "noopener,noreferrer");
    }
  }

  const handleCustomize = useCallback((c: VideoCustomization) => {
    setVideoCustomization(c);
  }, []);

  return (
    <>
      <Header stage={stage === "ready" ? "review" : (stage === "building" || stage === "enriching" || stage === "collaborating" || stage === "generating") ? "progress" : stage === "review" ? "review" : "input"} />
      <OnboardingModal />

      <main className="flex-1 w-full">
        {/* Post-checkout success toast */}
        <AnimatePresence>
          {purchasedPlan && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="max-w-md mx-auto mt-4 mb-2 px-6"
            >
              <div className="rounded-xl bg-success-soft border border-success/20 px-4 py-3 flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M2.5 6l2.5 2.5 4.5-5" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm font-medium text-ink">Credits added!</p>
                  <p className="text-label-base text-ink-muted">
                    {purchasedPlan.includes("credit") ? "Your credit pack" : "Your Pro subscription"} is active. Start building.
                  </p>
                </div>
                <button onClick={() => setPurchasedPlan(null)} className="text-ink-faint hover:text-ink transition-colors shrink-0">
                  <svg viewBox="0 0 12 12" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 3l6 6M9 3l-6 6" />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* ─── INPUT ────────────────────────────────────────────────── */}
          {stage === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
            >
              <section className="relative px-6 pt-24 pb-16">
                <div className="max-w-lg mx-auto space-y-8">
                  <div className="space-y-7 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-soft border border-accent/15">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                      <span className="text-label-sm uppercase tracking-widest font-medium text-accent">
                        AI twin · disclosed to your recipient
                      </span>
                    </div>
                    <h1 className="font-display text-5xl lg:text-6xl tracking-tight leading-[1.02]">
                      {mode === "reconnect" ? (
                        <>
                          Send a real
                          <br />
                          <span className="text-ink-muted">message to a real friend.</span>
                        </>
                      ) : (
                        <>
                          Brief an agent.
                          <br />
                          <span className="text-ink-muted">Get personalised creative.</span>
                        </>
                      )}
                    </h1>

                    {/* Voice brief — full card on desktop (sm:block), collapsible on mobile */}
                    <div className="space-y-3 text-left">
                      {/* Mobile toggle */}
                      <button
                        type="button"
                        onClick={() => setShowVoiceCard(!showVoiceCard)}
                        aria-expanded={showVoiceCard}
                        aria-controls="voice-brief-card"
                        className="sm:hidden flex items-center gap-2 text-label-base text-ink-muted hover:text-ink transition-colors py-2 w-full"
                      >
                        <svg viewBox="0 0 16 16" className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M8 2v8M5 6v4a3 3 0 006 0V6" />
                          <path d="M3 8a5 5 0 0010 0M8 13v2" />
                        </svg>
                        Brief with voice
                        <svg viewBox="0 0 16 16" className={`w-3 h-3 ml-auto transition-transform ${showVoiceCard ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M6 4l4 4-4 4" />
                        </svg>
                      </button>
                      <div id="voice-brief-card" className={`${showVoiceCard ? "block" : "hidden"} sm:block rounded-2xl border border-accent/20 bg-gradient-to-br from-accent-soft/60 via-white to-warm-soft/30 p-4 shadow-sm space-y-3`}>
                        <div className="flex items-start gap-3">
                          <div className="relative w-11 h-11 rounded-2xl bg-accent text-white flex items-center justify-center shadow-sm shrink-0">
                            <span className="absolute inset-0 rounded-2xl bg-accent animate-ping opacity-15" />
                            <svg viewBox="0 0 16 16" className="relative w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                              <path d="M8 2v8M5 6v4a3 3 0 006 0V6" />
                              <path d="M3 8a5 5 0 0010 0M8 13v2" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-body-sm font-medium text-ink">Talk to your video agent</p>
                              <span className="rounded-full bg-white/70 border border-accent/15 px-2 py-0.5 text-label-xs uppercase tracking-widest text-accent">
                                Speech Engine
                              </span>
                            </div>
                            <p className="mt-1 text-body-xs leading-relaxed text-ink-muted">
                              Say who you want to reach and why. Nuncio interviews you, extracts the brief, then fills this studio for you.
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => {
                              setVoiceOverlayMode("campaign");
                              setVoiceOverlayOpen(true);
                            }}
                            className="btn-press flex-1 rounded-xl border border-cream-dark bg-white text-ink py-3 text-body-sm font-medium hover:bg-cream-dark/30 transition-colors flex items-center justify-center gap-2"
                          >
                            Voice brief
                            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 8h10M9 4l4 4-4 4" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setVoiceOverlayMode("playbook");
                              setVoiceOverlayOpen(true);
                            }}
                            className="btn-press flex-1 rounded-xl border border-cream-dark bg-cream-soft text-ink py-3 text-body-sm font-medium hover:bg-cream-dark/30 transition-colors flex items-center justify-center gap-2"
                          >
                            Capture playbook
                            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 4l-6 6-2-2-2 2 4 4 8-8-2-2z" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {voiceBrief && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-2xl border border-success/20 bg-success-soft/40 p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-body-sm font-medium text-ink">Voice brief captured</p>
                              <p className="text-body-xs text-ink-muted">Review the extracted campaign context before researching.</p>
                            </div>
                            <button
                              onClick={() => {
                                setVoiceOverlayMode("campaign");
                                setVoiceOverlayOpen(true);
                              }}
                              className="text-label-base text-success hover:text-success/80 transition-colors"
                            >
                              Re-record
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-body-xs">
                            {voiceBrief.name && (
                              <div className="rounded-xl bg-white/70 border border-success/10 p-2">
                                <span className="block text-label-xs uppercase tracking-widest text-ink-faint">Recipient</span>
                                <span className="text-ink">{voiceBrief.name}</span>
                              </div>
                            )}
                            {(voiceBrief.company || voiceBrief.role) && (
                              <div className="rounded-xl bg-white/70 border border-success/10 p-2">
                                <span className="block text-label-xs uppercase tracking-widest text-ink-faint">Context</span>
                                <span className="text-ink">{[voiceBrief.role, voiceBrief.company].filter(Boolean).join(" · ")}</span>
                              </div>
                            )}
                            {voiceBrief.tone && (
                              <div className="rounded-xl bg-white/70 border border-success/10 p-2">
                                <span className="block text-label-xs uppercase tracking-widest text-ink-faint">Tone</span>
                                <span className="text-ink capitalize">{voiceBrief.tone}</span>
                              </div>
                            )}
                            {voiceBrief.archetype && (
                              <div className="rounded-xl bg-white/70 border border-success/10 p-2">
                                <span className="block text-label-xs uppercase tracking-widest text-ink-faint">Hook</span>
                                <span className="text-ink">{ARCHETYPE_OPTIONS.find((option) => option.id === voiceBrief.archetype)?.label || voiceBrief.archetype}</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}

                      <div>
                        <label className="text-label-sm uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
                          {mode === "reconnect" ? "Their public profile" : "Profile URL"}
                        </label>
                        {mode === "reconnect" && (
                          <p className="text-label-base text-ink-faint mb-2">
                            We only look at their public profile for context — the card is built from your memory, and you review every word.
                          </p>
                        )}
                        <input
                          value={url}
                          onChange={(e) => { setUrl(e.target.value); setUrlError(null); }}
                          onBlur={() => setUrlError(validateUrl(url))}
                          placeholder={mode === "reconnect" ? "https://linkedin.com/in/… or https://x.com/…" : "https://linkedin.com/in/…"}
                          className={`w-full rounded-xl border bg-white px-4 py-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-[color,background-color,border-color,opacity,box-shadow,transform] ${urlError ? "border-warm/50" : voicePopulatedFields.has("url") ? "border-success/50" : "border-cream-dark"}`}
                          onKeyDown={(e) => e.key === "Enter" && handleEnrich()}
                        />
                        {urlError && (
                          <p className="mt-1.5 text-label-sm text-warm flex items-center gap-1">
                            <svg viewBox="0 0 16 16" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <circle cx="8" cy="8" r="6" />
                              <path d="M8 5v3.5M8 10.5v.5" />
                            </svg>
                            {urlError}
                          </p>
                        )}
                        {voicePopulatedFields.has("url") && (
                          <span className="inline-flex items-center gap-1 mt-1 text-label-sm text-success">
                            <LottieIcon name="success-check" className="w-3 h-3" loop={false} />
                            Set by voice
                          </span>
                        )}
                          <div className="flex flex-wrap gap-2 mt-2">
                          {(mode === "reconnect"
                            ? []
                            : [
                                { label: "Sundar Pichai", url: "https://linkedin.com/in/sundarpichai", name: "Alex", brief: "I build developer tools and want to share how our platform can help Google Cloud teams ship faster." },
                                { label: "Vercel CEO", url: "https://x.com/rauchg", name: "Sam", brief: "We're building an AI-powered SDR tool and want to explore partnership opportunities with Vercel." },
                              ]
                          ).map((example) => (
                            <button
                              key={example.label}
                              onClick={() => {
                                setUrl(example.url);
                                if (!senderName.trim()) setSenderName(example.name);
                                if (!senderBrief.trim()) setSenderBrief(example.brief);
                              }}
                              className="text-label-base text-ink-muted hover:text-accent transition-colors px-2.5 py-1 rounded-md border border-cream-dark/70 hover:border-accent/30 bg-white/60"
                            >
                              Try {example.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-label-sm uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
                          Your name <span className="normal-case text-ink-faint">— how you sign off in the video</span>
                        </label>
                          <input
                            type="text"
                            value={senderName}
                            onChange={(e) => {
                              setSenderName(e.target.value);
                              if (typeof window !== "undefined") localStorage.setItem("nuncio_sender_name", e.target.value);
                            }}
                            placeholder="e.g. Udi"
                            className={`w-full rounded-xl border bg-white px-4 py-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-[color,background-color,border-color,opacity,box-shadow,transform] ${voicePopulatedFields.has("senderName") ? "border-success/50" : "border-cream-dark"}`}
                          />
                          {voicePopulatedFields.has("senderName") && (
                            <span className="inline-flex items-center gap-1 mt-1 text-label-sm text-success">
                              <LottieIcon name="success-check" className="w-3 h-3" loop={false} />
                              Set by voice
                            </span>
                          )}
                        </div>

                        <div>
                          <label className="text-label-sm uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
                            {mode === "reconnect" ? "Why you're reaching out" : "Brief"} <span className="normal-case text-ink-faint">— optional, but the agent uses it</span>
                          </label>
                          <textarea
                            value={senderBrief}
                            onChange={(e) => setSenderBrief(e.target.value)}
                            placeholder={mode === "reconnect" ? "e.g. I saw our old roommate last week and it made me think of you." : "What are you reaching out for? The more honest, the better."}
                            rows={2}
                            className={`w-full rounded-xl border bg-white px-4 py-3 text-body-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-[color,background-color,border-color,opacity,box-shadow,transform] ${voicePopulatedFields.has("senderBrief") ? "border-success/50" : "border-cream-dark"}`}
                          />
                          {voicePopulatedFields.has("senderBrief") && (
                            <span className="inline-flex items-center gap-1 mt-1 text-label-sm text-success">
                              <LottieIcon name="success-check" className="w-3 h-3" loop={false} />
                              Set by voice
                            </span>
                          )}
                        </div>

                        {mode === "reconnect" && (
                          <div>
                            <label className="text-label-sm uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
                              A real memory you share <span className="normal-case text-ink-faint">— required, this is the heart of the card</span>
                            </label>
                            <textarea
                              value={personalMemory}
                              onChange={(e) => setPersonalMemory(e.target.value)}
                              placeholder="e.g. We got hopelessly lost in Lisbon that summer and you somehow convinced a fisherman to give us a ride."
                              rows={3}
                              className={`w-full rounded-xl border bg-white px-4 py-3 text-body-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-[color,background-color,border-color,opacity,box-shadow,transform] ${personalMemory.trim().length >= 10 ? "border-success/50" : "border-cream-dark"}`}
                            />
                            <p className="mt-1.5 text-label-sm text-ink-faint">
                              The script is built around this, not their LinkedIn profile.
                            </p>
                          </div>
                        )}

                      {/* Advanced settings — collapsed by default */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAdvancedInput(!showAdvancedInput)}
                          aria-expanded={showAdvancedInput}
                          aria-controls="advanced-studio-settings"
                          className="text-label-base text-ink-faint hover:text-accent transition-colors flex items-center gap-1.5"
                        >
                          <svg viewBox="0 0 16 16" className={`w-3.5 h-3.5 transition-transform ${showAdvancedInput ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M6 4l4 4-4 4" />
                          </svg>
                          Advanced settings
                        </button>

<AnimatePresence>
                        {showAdvancedInput && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                            id="advanced-studio-settings"
                            className="mt-3 space-y-3 pl-4 border-l-2 border-cream-dark overflow-hidden"
                          >
                            <div>
                              <label className="text-label-sm uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
                                Hook archetype
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {ARCHETYPE_OPTIONS.map((option) => (
                                  <div key={option.id} className="flex flex-col">
                                    <button
                                      onClick={() => setArchetype(option.id)}
                                      className={`rounded-md border px-2.5 py-1 text-label-base transition-colors ${
                                        archetype === option.id
                                          ? "border-accent bg-accent-soft text-accent"
                                          : "border-cream-dark/70 bg-white/60 text-ink-muted hover:border-accent/30 hover:text-accent"
                                      }`}
                                    >
                                      {option.label}
                                    </button>
                                    {archetype === option.id && (
                                      <span className="text-label-sm text-ink-muted mt-1 max-w-[160px] leading-relaxed">
                                        {option.description}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Quality ladder & deep research */}
                            <div className="pt-2 border-t border-cream-dark">
                              <QualityLadder
                                currentTier={researchTier}
                                onSelect={setResearchTier}
                                userPlan={userPlan}
                                compact
                              />
                            </div>
                            <div>
                              <DeepResearchToggle
                                enabled={deepResearchEnabled}
                                onToggle={setDeepResearchEnabled}
                                userTier={userPlan}
                                compact
                              />
                            </div>

                            {/* Delivery mode — live link is the primary artifact when the pilot is enabled; recorded video is the fallback */}
                            <div>
                              <label className="text-label-sm uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
                                Delivery mode
                              </label>
                              {liveLinkEnabled ? (
                                <div className="flex rounded-xl border border-cream-dark bg-white p-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDeliveryModeChange("livelink")}
                                    className={`flex-1 rounded-lg py-2 text-body-xs font-medium transition-[color,background-color,border-color,opacity,box-shadow,transform] ${
                                      deliveryMode === "livelink"
                                        ? "bg-accent text-white shadow-sm"
                                        : "text-ink-muted hover:text-ink"
                                    }`}
                                  >
                                    Live link <span className="opacity-70 font-normal">· Recommended</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeliveryModeChange("video")}
                                    className={`flex-1 rounded-lg py-2 text-body-xs font-medium transition-[color,background-color,border-color,opacity,box-shadow,transform] ${
                                      deliveryMode === "video"
                                        ? "bg-accent text-white shadow-sm"
                                        : "text-ink-muted hover:text-ink"
                                    }`}
                                  >
                                    Video
                                  </button>
                                </div>
                              ) : null}
                              <p className="mt-1.5 text-label-sm text-ink-muted">
                                {deliveryMode === "video" || !liveLinkEnabled
                                  ? "Render a recorded MP4 share page. No live twin required."
                                  : "Your AI twin takes the first meeting live. Requires a trained live twin (photo + voice) and uses Anam credits per minute."}
                              </p>
                            </div>

                            {/* Booking link — powers the booking CTA on the live link and share page */}
                            <div>
                              <label className="text-label-sm uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
                                Booking link (optional)
                              </label>
                              <input
                                type="text"
                                value={bookingUrl}
                                onChange={(e) => setBookingUrl(e.target.value)}
                                placeholder="https://calendly.com/you/15min"
                                className="w-full rounded-lg border border-cream-dark px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                              />
                              <p className="mt-1.5 text-label-sm text-ink-muted">
                                Shown as “Book time with you” on your live link and share page.
                              </p>
                            </div>

                      </motion.div>
                        )}
                        </AnimatePresence>
                  </div>
                </div>

                {detectingLanguage && (
                  <span className="text-label-sm text-ink-faint flex items-center justify-center gap-2 block text-center">
                    <LottieIcon name="spinner" className="w-3 h-3" />
                    Detecting language…
                  </span>
                )}
                {detectedLanguage && !detectingLanguage && (
                  <div className="rounded-xl border border-warm/20 bg-warm-soft/40 p-3 flex items-center justify-between gap-3">
                    <span className="text-label-base text-ink-muted">
                      {detectedLanguage === "en" ? "English detected." : `${detectedLanguage.toUpperCase()} detected. Script stays English unless you choose otherwise.`}
                    </span>
                    {detectedLanguage !== "en" && (
                      <button
                        onClick={() => setTranslateEnabled(!translateEnabled)}
                        className={`shrink-0 rounded-full px-3 py-1 text-label-sm font-medium transition-colors ${
                          translateEnabled ? "bg-warm text-white" : "bg-white text-warm border border-warm/20"
                        }`}
                      >
                        {translateEnabled ? `Using ${detectedLanguage.toUpperCase()}` : `Use ${detectedLanguage.toUpperCase()}`}
                      </button>
                    )}
                  </div>
                )}

                <button
                  onClick={() => handleEnrich()}
                  disabled={!url.trim()}
                  className="btn-press w-full rounded-xl bg-ink text-cream py-3.5 text-body-sm font-medium disabled:opacity-40 hover:bg-ink-light transition-colors flex items-center justify-center gap-2"
                >
                  {mode === "reconnect" ? "Write a warm script" : "Research & write script"}
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </button>
                {session?.authenticated && typeof session.balance === "number" && (
                  <div className="flex items-center justify-between text-label-sm text-ink-faint mt-1.5 px-1">
                    <span>
                      Estimated cost: {researchTier === "deep" ? "~11" : researchTier === "balanced" ? "~8" : "~3"} credits
                      {" · "}Full video: {researchTier === "deep" ? "~19" : researchTier === "balanced" ? "~16" : "~11"}
                    </span>
                    <span className={session.balance < 11 ? "text-warm font-medium" : ""}>
                      {session.balance} available
                    </span>
                  </div>
                )}

                {/* Flow steps + batch link — below CTA to reduce mobile scroll */}
                <div className="pt-4 space-y-3">
                  <div className="flex items-center justify-center gap-2 text-label-sm uppercase tracking-widest text-ink-faint">
                    <span className="text-accent">Account</span>
                    <span>→</span>
                    <span>Reason</span>
                    <span>→</span>
                    <span>Review</span>
                    <span>→</span>
                    <span>Send</span>
                  </div>
                  <div className="text-center">
                    <Link
                      href="/batch"
                      className="text-label-base text-accent hover:text-accent/80 transition-colors inline-block"
                    >
                      Need to reach multiple people? Try Batch →
                    </Link>
                  </div>
                </div>
                </div>
                </div>
              </section>

            </motion.div>
          )}

          {/* ─── ENRICHING ───────────────────────────────────────────── */}
          {stage === "enriching" && (
            <motion.div
              key="enriching"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-6 pt-24 pb-16 max-w-xl mx-auto"
            >
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-soft border border-accent/15 mb-4">
                  <LottieIcon name="spinner" className="w-3 h-3" />
                  <span className="text-label-sm uppercase tracking-widest font-medium text-accent">
                    Researching
                  </span>
                </div>
                <h1 className="font-display text-3xl tracking-tight">
                  {mode === "reconnect" ? "Finding things worth mentioning" : "Reading their profile"}
                </h1>
                <p className="text-body-sm text-ink-muted mt-2">
                  {mode === "reconnect"
                    ? "We'll look at their public profile for context, but the script is built around what you tell us."
                    : "Three agents working together to research and personalise your video."}
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { id: "enrich" as const, label: "Enrich", desc: "Fetching public data from their profile", tool: "tinyfish" },
                  { id: "synthesise" as const, label: "Synthesise", desc: "Building a structured profile with Claude", tool: "claude" },
                  { id: "compose" as const, label: "Compose", desc: "Drafting your personalised script", tool: "claude" },
                ].map((step) => {
                  const active = pipelineStep === step.id;
                  const done = pipelineStep === "synthesise" && step.id === "enrich" ||
                    pipelineStep === "compose" && (step.id === "enrich" || step.id === "synthesise");
                  const complete = done;
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-4 rounded-xl border p-4 transition-[color,background-color,border-color,opacity,box-shadow,transform] duration-500 ${
                        active
                          ? "border-accent/30 bg-accent-soft shadow-sm"
                          : complete
                            ? "border-cream-dark bg-cream-soft"
                            : "border-cream-dark bg-white opacity-50"
                      }`}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-body-xs font-mono font-medium transition-[color,background-color,border-color,opacity,box-shadow,transform] duration-500">
                        {complete ? (
                          <LottieIcon name="success-check" className="w-4 h-4" loop={false} />
                        ) : active ? (
                          <LottieIcon name="spinner" className="w-4 h-4" />
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-body-sm font-medium transition-colors ${
                            active ? "text-accent" : complete ? "text-ink" : "text-ink-muted"
                          }`}>
                            {step.label}
                          </span>
                          <span className="text-label-sm font-mono text-ink-faint">{step.tool}</span>
                        </div>
                        <p className={`text-body-xs mt-0.5 transition-colors ${
                          active || complete ? "text-ink-muted" : "text-ink-faint"
                        }`}>
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ─── GENERATING (unified pipeline) ───────────────────────── */}
          {stage === "generating" && bandSessionId && (
            <CollaborativeSession
              key="generating"
              sessionId={bandSessionId}
              events={bandEvents}
              onSendMessage={handleBandSendMessage}
              onComplete={handleBandComplete}
              onSkipAhead={() => {
                const lastComplete = bandEvents.find((e) => e.eventType === "complete");
                if (lastComplete?.metadata) {
                  const { script, profile } = lastComplete.metadata as { script?: string; profile?: Record<string, unknown> };
                  if (script) {
                    handleBandComplete({ script, profile });
                  }
                }
              }}
            />
          )}

          {/* ─── COLLABORATING (Band demo mode) ────────────────────── */}
          {stage === "collaborating" && bandSessionId && (
            <CollaborativeSession
              key="collaborating"
              sessionId={bandSessionId}
              events={bandEvents}
              onSendMessage={handleBandSendMessage}
              onComplete={handleBandComplete}
            />
          )}

          {/* ─── REVIEW ──────────────────────────────────────────────── */}
          {stage === "review" && reviewProfile && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-6 pt-24 pb-16 max-w-3xl mx-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success-soft border border-success/15">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  <span className="text-label-sm uppercase tracking-widest font-medium text-success">
                    Review
                  </span>
                </div>
              </div>
              <h1 className="font-display text-3xl tracking-tight">
                {mode === "reconnect" ? "Review your message" : "Review the script"}
              </h1>
              <p className="text-body-sm text-ink-muted mt-2 mb-8">
                {mode === "reconnect" ? "Edit anything below, then create the card." : "Edit anything below, then build the final video."}
              </p>

              {/* Research quality warning — prevents wasted render credits */}
              {researchQuality && researchQuality.confidence === "low" && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <svg viewBox="0 0 20 20" className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="currentColor">
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-body-sm font-medium text-amber-900">
                        Low-confidence profile — review before rendering
                      </p>
                      <p className="text-body-xs text-amber-800 mt-1">
                        Research found {researchQuality.sourceCount} source(s) and {researchQuality.recentPostCount} recent post(s).
                        {researchQuality.usedSearchFallback && " Search fallback was used."}
                        {researchQuality.warnings.length > 0 && ` ${researchQuality.warnings[0]}`}
                      </p>
                      <p className="text-body-xs text-amber-700 mt-2">
                        The profile may be incomplete or mischaracterized. Consider editing the details below or trying a different URL (e.g. LinkedIn instead of Twitter) before spending a render credit.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {researchQuality && researchQuality.confidence === "medium" && researchQuality.warnings.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 mb-6">
                  <p className="text-body-xs text-amber-800">
                    ⚠ Research degraded: {researchQuality.warnings[0]}
                  </p>
                </div>
              )}

              <div className="space-y-6">
                {/* Profile card — collapsed by default */}
                <div className="rounded-xl border border-cream-dark bg-white p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-label-sm uppercase tracking-widest font-medium text-ink-muted">Profile</div>
                    <button
                      onClick={() => setShowProfileEditor(!showProfileEditor)}
                      className="text-label-base text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
                    >
                      {showProfileEditor ? "Collapse" : "Edit details"}
                      <svg viewBox="0 0 16 16" className={`w-3 h-3 transition-transform ${showProfileEditor ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M4 6l4 4 4-4" />
                      </svg>
                    </button>
                  </div>
                  <div>
                    <p className="text-body-sm text-ink font-medium">{reviewProfile.name}</p>
                    <p className="text-body-xs text-ink-muted">
                      {[reviewProfile.current_role, reviewProfile.company && `at ${reviewProfile.company}`].filter(Boolean).join(" ") || "No role detected"}
                    </p>
                  </div>

                  {showProfileEditor && (
                    <>
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-cream-dark">
                        <div>
                          <label className="text-label-sm text-ink-faint block mb-1">Name</label>
                          <input
                            type="text"
                            value={reviewProfile.name}
                            onChange={(e) => setReviewProfile({ ...reviewProfile, name: e.target.value })}
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div>
                          <label className="text-label-sm text-ink-faint block mb-1">Company</label>
                          <input
                            type="text"
                            value={reviewProfile.company}
                            onChange={(e) => setReviewProfile({ ...reviewProfile, company: e.target.value })}
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-label-sm text-ink-faint block mb-1">Role</label>
                          <input
                            type="text"
                            value={reviewProfile.current_role}
                            onChange={(e) => setReviewProfile({ ...reviewProfile, current_role: e.target.value })}
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-cream-dark">
                        <div>
                          <label className="text-label-sm text-ink-faint block mb-1">Your business</label>
                          <input
                            type="text"
                            value={senderBusiness}
                            onChange={(e) => setSenderBusiness(e.target.value)}
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div>
                          <label className="text-label-sm text-ink-faint block mb-1">Brand</label>
                          <input
                            type="text"
                            value={senderBrand}
                            onChange={(e) => setSenderBrand(e.target.value)}
                            placeholder="e.g. thoughtful, technical, premium"
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div>
                          <label className="text-label-sm text-ink-faint block mb-1">Personality</label>
                          <input
                            type="text"
                            value={senderPersonality}
                            onChange={(e) => setSenderPersonality(e.target.value)}
                            placeholder="e.g. founder-led, direct, curious"
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div>
                          <label className="text-label-sm text-ink-faint block mb-1">Audience / ICP</label>
                          <input
                            type="text"
                            value={senderAudience}
                            onChange={(e) => setSenderAudience(e.target.value)}
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-label-sm text-ink-faint block mb-1">Offer</label>
                          <input
                            type="text"
                            value={senderOffer}
                            onChange={(e) => setSenderOffer(e.target.value)}
                            placeholder="What are you offering this person?"
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div>
                          <label className="text-label-sm text-ink-faint block mb-1">Goal</label>
                          <input
                            type="text"
                            value={outreachGoal}
                            onChange={(e) => setOutreachGoal(e.target.value)}
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div>
                          <label className="text-label-sm text-ink-faint block mb-1">Desired outcome</label>
                          <input
                            type="text"
                            value={desiredOutcome}
                            onChange={(e) => setDesiredOutcome(e.target.value)}
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div>
                          <label className="text-label-sm text-ink-faint block mb-1">Relationship</label>
                          <select
                            value={relationshipWarmth}
                            onChange={(e) => setRelationshipWarmth(e.target.value as "cold" | "warm" | "existing")}
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
                          >
                            <option value="cold">Cold</option>
                            <option value="warm">Warm</option>
                            <option value="existing">Existing</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-label-sm text-ink-faint block mb-1">Tone preference</label>
                          <input
                            type="text"
                            value={tonePreference}
                            onChange={(e) => setTonePreference(e.target.value)}
                            placeholder="e.g. warm, crisp, bold"
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-label-sm text-ink-faint block mb-1">Why now</label>
                          <textarea
                            value={reasonForReachingOutNow}
                            onChange={(e) => setReasonForReachingOutNow(e.target.value)}
                            rows={2}
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-body-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-label-sm text-ink-faint block mb-1">Proof points</label>
                          <textarea
                            value={senderProofPoints}
                            onChange={(e) => setSenderProofPoints(e.target.value)}
                            rows={3}
                            placeholder="One per line: traction, customers, credibility, outcomes"
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-body-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                      </div>

                      {/* Tone selector */}
                      <div>
                        <label className="text-label-sm text-ink-faint block mb-2">Tone</label>
                        <div className="flex gap-2">
                          {(["conversational", "formal", "technical"] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => setReviewProfile({ ...reviewProfile, tone: t })}
                              className={`px-3 py-1.5 rounded-md border text-body-xs transition-colors ${
                                reviewProfile.tone === t
                                  ? "border-accent bg-accent-soft text-accent"
                                  : "border-cream-dark text-ink-muted hover:border-accent/30"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Language selector */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-label-sm text-ink-faint block">
                            Language
                            <span className="ml-1.5 text-warm">(auto-detected)</span>
                          </label>
                          <label className="flex items-center gap-1.5 text-label-sm text-ink-faint cursor-pointer select-none">
                            <span className={translateEnabled ? "text-warm" : "text-ink-faint"}>
                              {translateEnabled ? `Translate` : `English`}
                            </span>
                            <button
                              onClick={() => setTranslateEnabled(!translateEnabled)}
                              className={`relative w-8 h-4 rounded-full transition-colors ${
                                translateEnabled ? "bg-warm" : "bg-cream-dark"
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                                  translateEnabled ? "translate-x-4" : ""
                                }`}
                              />
                            </button>
                          </label>
                        </div>
                        <select
                          value={reviewProfile.language || "en"}
                          onChange={(e) => setReviewProfile({ ...reviewProfile, language: e.target.value })}
                          className="w-full rounded-lg border border-cream-dark px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
                        >
                          {LANGUAGES.map((l) => (
                            <option key={l.code} value={l.code}>{l.label}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>

                {/* Suggested outreach angles — helps user pick a direction before rendering */}
                {reviewProfile.suggestedAngles && reviewProfile.suggestedAngles.length > 0 && (
                  <div className="rounded-xl border border-cream-dark bg-white p-5 space-y-3">
                    <div className="text-label-sm uppercase tracking-widest font-medium text-ink-muted">Suggested angles</div>
                    <div className="space-y-2">
                      {reviewProfile.suggestedAngles.map((angle, i) => (
                        <div key={angle.id || i} className="flex items-start gap-2">
                          <span className={`text-label-xs uppercase tracking-wider font-medium px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
                            angle.confidence === "high" ? "bg-success-soft text-success" :
                            angle.confidence === "medium" ? "bg-amber-50 text-amber-700" :
                            "bg-cream-dark text-ink-muted"
                          }`}>
                            {angle.confidence}
                          </span>
                          <div className="flex-1">
                            <p className="text-body-xs font-medium text-ink">{angle.label}</p>
                            <p className="text-label-base text-ink-muted mt-0.5">{angle.description}</p>
                            {angle.evidence && (
                              <p className="text-label-sm text-ink-faint mt-1 italic">{angle.evidence}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Script */}
                <div className="rounded-xl border border-cream-dark bg-white p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="text-label-sm uppercase tracking-widest font-medium text-ink-muted">Script</div>
                      <button
                        onClick={() => setScriptEditing(!scriptEditing)}
                        className="text-label-base text-accent hover:text-accent/80 transition-colors"
                      >
                        {scriptEditing ? "Done" : "Edit"}
                      </button>
                    </div>
                    <button
                      onClick={() => handleRegenerate()}
                      disabled={reviewRegenerating}
                      className="text-label-base text-accent hover:text-accent/80 disabled:opacity-50 flex items-center gap-1"
                    >
                      {reviewRegenerating ? (
                        <LottieIcon name="spinner" className="w-3 h-3" />
                      ) : (
                        <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 8a6 6 0 0 1 10.5-4M14 8a6 6 0 0 1-10.5 4" />
                          <path d="M12 2v4h-4M4 14v-4h4" />
                        </svg>
                      )}
                      Regenerate
                    </button>
                  </div>

                  {/* Variant picker */}
                  {reviewScriptVariantA && reviewScriptVariantB && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setReviewSelectedVariant("a"); setReviewScript(reviewScriptVariantA); }}
                        className={`flex-1 px-3 py-2 rounded-lg border text-body-xs font-medium transition-colors ${
                          reviewSelectedVariant === "a"
                            ? "border-accent bg-accent-soft text-accent"
                            : "border-cream-dark text-ink-muted hover:border-accent/30"
                        }`}
                      >
                        Variant A
                        {reviewScriptVariantA === reviewScript && " ✓"}
                      </button>
                      <button
                        onClick={() => { setReviewSelectedVariant("b"); setReviewScript(reviewScriptVariantB); }}
                        className={`flex-1 px-3 py-2 rounded-lg border text-body-xs font-medium transition-colors ${
                          reviewSelectedVariant === "b"
                            ? "border-accent bg-accent-soft text-accent"
                            : "border-cream-dark text-ink-muted hover:border-accent/30"
                        }`}
                      >
                        Variant B
                        {reviewScriptVariantB === reviewScript && " ✓"}
                      </button>
                    </div>
                  )}

                  {scriptEditing ? (
                    <textarea
                      value={reviewScript}
                      onChange={(e) => { setReviewScript(e.target.value); setTtsAudioUrl(null); }}
                      rows={6}
                      className="w-full rounded-lg border border-cream-dark px-3 py-2 text-body-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  ) : (
                    <div className="w-full rounded-lg border border-cream-dark/50 bg-cream/30 px-3 py-3 text-body-sm leading-relaxed text-ink whitespace-pre-wrap">
                      {reviewScript}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="text-label-base text-ink-faint">
                      {reviewScript.split(/\s+/).filter(Boolean).length} words · ~{Math.round(reviewScript.split(/\s+/).filter(Boolean).length / 2.5)}s at natural pace
                    </p>
                    <button
                      onClick={handleTtsPreview}
                      disabled={ttsLoading || !reviewScript.trim()}
                      className="text-label-base text-accent hover:text-accent/80 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                    >
                      {ttsLoading ? (
                        <LottieIcon name="spinner" className="w-3 h-3" />
                      ) : ttsPlaying ? (
                        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
                          <rect x="3" y="3" width="4" height="10" rx="1" />
                          <rect x="9" y="3" width="4" height="10" rx="1" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M3 6.5v3a1 1 0 001 1h1.5l3 2.5V3L5.5 5.5H4a1 1 0 00-1 1z" />
                          <path d="M10 5.5c.7.7.7 5.3 0 5M12 4c1.3 1.3 1.3 7.7 0 8" />
                        </svg>
                      )}
                      {ttsLoading ? "Generating..." : ttsPlaying ? "Stop" : "Hear it"}
                    </button>
                  </div>
                </div>

                {/* Hook info — compact by default */}
                {reviewHook && (
                  <div className="rounded-xl border border-cream-dark bg-white">
                    <button
                      onClick={() => setShowHookReasoning(!showHookReasoning)}
                      className="w-full flex items-center justify-between p-4 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded bg-warm-soft border border-warm/20 text-label-base text-warm font-medium">
                          {reviewHook.archetype}
                        </span>
                        <span className="text-body-xs text-ink-muted">{reviewHook.format}</span>
                      </div>
                      <svg viewBox="0 0 16 16" className={`w-3.5 h-3.5 text-ink-faint transition-transform ${showHookReasoning ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M4 6l4 4 4-4" />
                      </svg>
                    </button>
                    {showHookReasoning && (
                      <div className="px-4 pb-4">
                        <p className="text-body-xs text-ink-muted leading-relaxed">{reviewHook.reasoning}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Avatar & Voice customization */}
                <div className="border-t border-cream-dark/50 pt-4 mt-4">
                  <button
                    onClick={() => setShowCustomization(!showCustomization)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      <svg viewBox="0 0 16 16" className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="8" cy="5" r="3" />
                        <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" />
                      </svg>
                      <span className="text-body-xs font-medium text-ink">Customize avatar & voice</span>
                    </div>
                    <svg viewBox="0 0 16 16" className={`w-3.5 h-3.5 text-ink-faint transition-transform ${showCustomization ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 6l4 4 4-4" />
                    </svg>
                  </button>
                  <AnimatePresence>
                    {showCustomization && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-3"
                      >
                        <VideoCustomizationComponent
                          onCustomize={handleCustomize}
                          initialAvatars={initialAvatars}
                          initialVoices={initialVoices}
                          recommendedVibeId={buildResult?.recommendedVibeId}
                          suggestedLanguage={detectedLanguage || undefined}
                          script={reviewScript || undefined}
                          defaultToClone={mode === "reconnect"}
                          mode={mode}
                          deliveryMode={deliveryMode}
                          liveLinkEnabled={liveLinkEnabled}
                          enableLiveTwin={enableLiveTwin}
                          onEnableLiveTwinChange={setEnableLiveTwin}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Actions — sticky */}
                <div className="sticky bottom-4 z-10 bg-gradient-to-t from-cream via-cream/95 to-transparent pt-6 pb-2 -mx-6 px-6 space-y-2">
                  {session?.authenticated && typeof session.balance === "number" && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-label-base">
                        <span className="text-ink-faint">{session.balance} credits remaining</span>
                        <span className="text-ink-faint">Render: 8 · Soundscape: 1</span>
                      </div>
                      {session.balance < 9 && (
                        <div className="flex items-center justify-between rounded-lg bg-warm-soft/50 border border-warm/15 px-3 py-2">
                          <span className="text-label-base text-warm font-medium">Low balance — you need 9 credits to render</span>
                          <a href="/pricing" className="text-label-sm text-accent font-bold uppercase tracking-widest hover:text-accent/80 transition-colors">
                            Top up
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setStage("input")}
                      className="flex-1 rounded-xl border border-cream-dark bg-white py-3 text-body-sm font-medium text-ink-muted hover:border-ink/30 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleConfirmBuild}
                      disabled={
                        deliveryMode === "livelink" &&
                        (!videoCustomization?.anamAvatarId || !videoCustomization?.anamVoiceId)
                      }
                      title={
                        deliveryMode === "livelink" &&
                        (!videoCustomization?.anamAvatarId || !videoCustomization?.anamVoiceId)
                          ? "Enable 'Train live twin' and upload a photo + voice sample first"
                          : undefined
                      }
                      className="flex-[2] btn-press rounded-xl bg-ink text-cream py-3 text-body-sm font-medium hover:bg-ink-light transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {mode === "reconnect"
                        ? "Create reconnection card"
                        : deliveryMode === "livelink" ? "Create live link" : "Build final video"}
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 8h10M9 4l4 4-4 4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── BUILDING ─────────────────────────────────────────────── */}
          {stage === "building" && (
            <QuickProgress
              key="quick-progress"
              showDetails={showProgressDetails}
              onToggleDetails={() => setShowProgressDetails(!showProgressDetails)}
              currentStep={buildStep}
              elapsedSeconds={buildElapsedSeconds}
              videoRendering={videoRendering}
              waitContext={{
                recipientName: reviewProfile?.name,
                senderName: senderName || undefined,
                script: reviewScript || undefined,
                recentActivity,
                recentActivityPosts,
              }}
              onDraftReady={(draft) => setDraftMessage(draft)}
            />
          )}

          {/* ─── ERROR ────────────────────────────────────────────────── */}
          {stage === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md mx-auto pt-32 px-6 text-center space-y-4"
            >
              {insufficientCredits ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-warm-soft flex items-center justify-center mx-auto">
                    <svg viewBox="0 0 16 16" className="w-5 h-5 text-warm" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M8 1v6M8 9v.5" />
                      <path d="M1.5 12.5L8 1.5l6.5 11H1.5z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-ink">Not enough credits</h3>
                  <p className="text-body-sm text-ink-muted">
                    This action needs <span className="font-semibold text-ink">{insufficientCredits.required} credits</span> but you have <span className="font-semibold text-ink">{insufficientCredits.available}</span>.
                  </p>
                  <div className="rounded-xl border border-cream-dark bg-white p-4 space-y-3 text-left">
                    <p className="text-label-sm uppercase tracking-widest text-ink-faint font-medium">Top up options</p>
                    <a
                      href="/pricing"
                      className="btn-press flex items-center justify-between rounded-xl bg-ink text-cream px-4 py-3 text-body-sm font-medium hover:bg-ink-light transition-colors"
                    >
                      <span>Get Pro — 200 credits/month</span>
                      <span className="text-cream/60">$39/mo</span>
                    </a>
                    <a
                      href="/pricing#packs"
                      className="btn-press flex items-center justify-between rounded-xl border border-cream-dark px-4 py-3 text-body-sm font-medium text-ink hover:bg-cream-dark/30 transition-colors"
                    >
                      <span>Buy a credit pack</span>
                      <span className="text-ink-faint">from $15</span>
                    </a>
                  </div>
                  <button
                    onClick={() => { setInsufficientCredits(null); setStage("input"); }}
                    className="text-label-base text-ink-faint hover:text-accent transition-colors"
                  >
                    Back to studio
                  </button>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-error-soft flex items-center justify-center mx-auto">
                    <svg viewBox="0 0 16 16" className="w-5 h-5 text-error" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="8" cy="8" r="6" />
                      <path d="M8 5v3.5M8 10.5v.5" />
                    </svg>
                  </div>
                  {(() => {
                    const friendly = friendlyError(error);
                    return (
                      <div className="space-y-2">
                        <h3 className="text-base font-semibold text-ink">{friendly.title}</h3>
                        <p className="text-body-sm text-ink-light">{friendly.detail}</p>
                        {friendly.tip && (
                          <p className="text-body-xs text-ink-faint italic">{friendly.tip}</p>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    {bandSessionId && (
                      <button
                        onClick={() => handleEnrich(bandSessionId)}
                        className="btn-press rounded-xl bg-ink text-cream px-5 py-3 text-body-sm font-medium hover:bg-ink-light transition-colors flex items-center gap-2"
                      >
                        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 8a6 6 0 0111.5-2.5M14 8a6 6 0 01-11.5 2.5" />
                          <path d="M14 2v4h-4M2 14v-4h4" />
                        </svg>
                        Retry from checkpoint
                      </button>
                    )}
                    <button
                      onClick={() => setStage("input")}
                      className="btn-press rounded-xl border border-cream-dark px-5 py-3 text-body-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors"
                    >
                      Start over
                    </button>
                    {error.toLowerCase().includes("login wall") || error.toLowerCase().includes("could not access") ? (
                      <button
                        onClick={() => { setUrl(""); setStage("input"); }}
                        className="btn-press rounded-xl border border-cream-dark px-5 py-3 text-body-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors"
                      >
                        Try a different URL
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ─── READY ────────────────────────────────────────────────── */}
          {stage === "ready" && buildResult && (
            <motion.div
              key="ready"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-6 pt-24 pb-12 max-w-5xl mx-auto space-y-6"
            >
              {/* Header + actions */}
              <div className="rounded-2xl border border-cream-dark bg-gradient-to-br from-white via-white to-accent-soft/30 p-6 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-success-soft border border-success/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" />
                    <span className="text-label-sm uppercase tracking-widest font-medium text-success">
                      {deliveryMode === "livelink" ? "Live link ready" : videoRendering === "done" ? "Video ready" : "Creative ready"}
                    </span>
                  </div>
                  <p className="text-body-sm text-ink">
                    {deliveryMode === "livelink"
                      ? <>Share the link to start a live conversation.</>
                      : videoRendering === "done"
                        ? <>Video rendered successfully.</>
                        : <>Rendering in progress…</>}
                  </p>
                  <button
                    onClick={() => {
                      setStage("input");
                      setBuildResult(null);
                      setUrl("");
                      setSenderBrief("");
                      setArchetype("auto");
                      setShareUrl("");
                      setShowHookReasoning(false);
                      setVideoRendering("idle");
                      setVideoRenderResult(null);
                    }}
                    className="btn-press ml-auto rounded-lg border border-cream-dark px-3 py-1.5 text-label-base font-medium text-ink-muted hover:text-ink hover:bg-cream-dark/40 transition-colors"
                  >
                    Start another
                  </button>
                </div>

                <div className="border-t border-cream-dark/50 pt-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {deliveryMode !== "livelink" && (
                      <button
                        onClick={() => {
                          if (!capturedEmail) { openCapture("render"); } else { handleRenderVideo(); }
                        }}
                        disabled={videoRendering === "rendering"}
                        className="btn-press inline-flex items-center gap-2 rounded-xl bg-ink text-cream px-5 py-3 text-body-sm font-medium hover:bg-ink-light transition-colors shadow-sm disabled:opacity-40"
                      >
                        {videoRendering === "rendering" ? "Rendering…" : videoRendering === "done" ? "Video ready" : "Render video"}
                      </button>
                    )}

                    {deliveryMode !== "livelink" && (
                      <span className="w-px h-8 bg-cream-dark" />
                    )}

                    <button
                      onClick={handleShareClick}
                      className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-cream-dark px-3 py-2.5 text-body-xs font-medium text-ink-muted hover:bg-cream-dark/50 transition-colors"
                    >
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M4 10l4 4 4-4M8 2v10" />
                      </svg>
                      Share
                    </button>

                    <div className="flex-1" />

                    <a
                      href="/batch"
                      onClick={() => {
                        localStorage.setItem("nuncio_sender_brief", senderBrief || "");
                        if (reviewProfile) {
                          localStorage.setItem("nuncio_profile_name", reviewProfile.name || "");
                          localStorage.setItem("nuncio_profile_company", reviewProfile.company || "");
                        }
                      }}
                      className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-accent/20 bg-accent-soft/50 px-3 py-2.5 text-body-xs font-medium text-accent hover:bg-accent/10 transition-colors"
                    >
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 4h12v10H2zM2 4l6 5 6-5M5 2h6" />
                      </svg>
                      Send to all
                    </a>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {deliveryMode !== "livelink" && (
                      <button
                        onClick={handleAudioMemo}
                        disabled={audioMemoLoading}
                        className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-cream-dark px-2.5 py-1.5 text-label-base text-ink-faint hover:text-ink-muted hover:bg-cream-dark/30 transition-colors disabled:opacity-50"
                        title="Generate a voice memo teaser to send as a DM hook"
                      >
                      {audioMemoLoading ? (
                        <LottieIcon name="spinner" className="w-3 h-3" />
                      ) : (
                        <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M8 2v8M5 6v4a3 3 0 006 0V6" />
                          <path d="M3 8a5 5 0 0010 0M8 13v2" />
                        </svg>
                      )}
                      {audioMemoUrl ? "Memo ready" : "Audio memo"}
                    </button>
                    )}
                  </div>
                </div>

                {/* Audio memo player */}
                {audioMemoUrl && (
                  <div className="rounded-xl border border-accent/20 bg-accent-soft/30 p-4 flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-label-sm uppercase tracking-widest font-medium text-accent mb-1">Audio Memo Ready</p>
                      <p className="text-label-base text-ink-muted">Send this as a DM teaser before sharing the full video link.</p>
                    </div>
                    <audio src={audioMemoUrl} controls className="h-8 w-48" />
                    <a
                      href={audioMemoUrl}
                      download="nuncio-audio-memo.mp3"
                      className="p-2 rounded-lg border border-accent/20 text-accent hover:bg-accent/10 transition-colors"
                      title="Download memo"
                    >
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M8 2v9M4.5 7.5L8 11l3.5-3.5M2 14h12" />
                      </svg>
                    </a>
                  </div>
                )}

                {/* Saved draft message */}
                {draftMessage && (
                  <div className="border-t border-cream-dark/50 pt-3 space-y-2">
                    <p className="text-label-sm uppercase tracking-widest font-medium text-ink-faint">
                      Your {draftMessage.channel} draft
                    </p>
                    <div className="rounded-lg bg-cream-dark/30 p-3 text-body-xs text-ink-light leading-relaxed whitespace-pre-wrap">
                      {draftMessage.message}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(draftMessage.message);
                      }}
                      className="text-label-base text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
                    >
                      <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="5" y="5" width="8" height="8" rx="1.5" />
                        <path d="M3 11V3h8" />
                      </svg>
                      Copy to clipboard
                    </button>
                  </div>
                )}

                {/* Re-render with different customization */}
                {deliveryMode !== "livelink" && (
                <div className="border-t border-cream-dark/50 pt-3 flex items-center justify-between">
                  <button
                    onClick={() => { setShowCustomization(true); setStage("review"); }}
                    className="text-label-base text-ink-faint hover:text-accent transition-colors flex items-center gap-1.5"
                  >
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="8" cy="5" r="3" />
                      <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" />
                    </svg>
                    Change avatar or voice & re-render
                  </button>
                  {session?.authenticated && typeof session.balance === "number" && (
                    <span className="text-label-base text-ink-faint">
                      {session.balance} credits remaining
                    </span>
                  )}
                </div>
                )}
              </div>

              {/* Video result */}
              {videoRenderResult && videoRendering === "done" && (
                <VideoResultSection videoUrl={videoRenderResult.videoUrl} />
              )}

              {/* Next actions — circular flow */}
              {videoRendering === "done" && (
                <div className="space-y-3 pt-2">
                  <button
                    onClick={() => {
                      setStage("input");
                      setBuildResult(null);
                      setUrl("");
                      setSenderBrief("");
                      setArchetype("auto");
                      setShareUrl("");
                      setShowHookReasoning(false);
                      setVideoRendering("idle");
                      setVideoRenderResult(null);
                    }}
                    className="btn-press w-full rounded-xl bg-ink text-cream py-3.5 text-body-sm font-medium hover:bg-ink-light transition-colors flex items-center justify-center gap-2"
                  >
                    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 8h10M9 4l4 4-4 4" />
                    </svg>
                    Create another video
                  </button>
                  <div className="flex items-center gap-2">
                    <a
                      href="/dashboard"
                      className="btn-press flex-1 rounded-xl border border-cream-dark py-3 text-body-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="2" y="2" width="5" height="5" rx="1" />
                        <rect x="9" y="2" width="5" height="5" rx="1" />
                        <rect x="2" y="9" width="5" height="5" rx="1" />
                        <rect x="9" y="9" width="5" height="5" rx="1" />
                      </svg>
                      View dashboard
                    </a>
                    <a
                      href="/batch"
                      className="btn-press flex-1 rounded-xl border border-cream-dark py-3 text-body-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M5 8h6M8 5v6" />
                        <circle cx="8" cy="8" r="6" />
                      </svg>
                      Batch create
                    </a>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Email capture modal */}
      <AnimatePresence>
        {captureIntent && (
          <motion.div
            key="email-capture"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm flex items-center justify-center px-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="w-full max-w-md rounded-2xl border border-cream-dark bg-white p-6 shadow-2xl shadow-ink/15"
            >
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="space-y-3">
                  {(() => {
                    const meta = INTENT_META[captureIntent];
                    return (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 350, damping: 20, mass: 0.8 }}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-label-sm font-medium uppercase tracking-widest ${meta.chipClass}`}
                      >
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center ${meta.iconClass}`}>
                          {meta.icon}
                        </span>
                        {meta.label}
                      </motion.span>
                    );
                  })()}
                  <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="font-display text-3xl tracking-tight"
                  >
                    {captureIntent === "download" ? "Download video" : captureIntent === "share" ? "Share video" : captureIntent === "saveBrief" ? "Save your brief" : "Render video"}
                  </motion.h2>
                </div>
                <button
                  onClick={() => setCaptureIntent(null)}
                  className="rounded-lg border border-cream-dark px-2 py-1 text-body-xs text-ink-muted hover:text-ink hover:bg-cream/60 transition-colors"
                >
                  Close
                </button>
              </div>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="text-body-sm text-ink-muted leading-relaxed mb-5"
              >
                {captureIntent === "download" && "Enter your email and we'll send you a download link for your video."}
                {captureIntent === "share" && "Enter your email and we'll send you a shareable link you can copy."}
                {captureIntent === "render" && "Enter your email and we'll render your video. We'll notify you when it's ready."}
                {captureIntent === "saveBrief" && "Enter your email to save this brief to your account. We'll also send you a shareable link."}
                {!session?.authenticated && (
                  <span className="block mt-2 text-body-xs text-accent">
                    Free account includes 15 starter credits — enough for a full video. Go Pro for 200 credits/month (~18 videos).
                  </span>
                )}
              </motion.p>

              <motion.form
                onSubmit={handleEmailCapture}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.26, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-3"
              >
                <input
                  value={captureHoneypot}
                  onChange={(e) => setCaptureHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  className="hidden"
                  aria-hidden="true"
                />
                <div>
                  <label className="text-label-sm uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={captureEmail}
                    onChange={(e) => setCaptureEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-xl border border-cream-dark bg-white px-4 py-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-[color,background-color,border-color,opacity,box-shadow,transform]"
                    autoFocus
                  />
                </div>

                {captureError && (
                  <p className="text-body-xs text-error">{captureError}</p>
                )}

                <button
                  type="submit"
                  disabled={captureLoading || !captureEmail.trim()}
                  className="btn-press w-full rounded-xl bg-ink text-cream py-3.5 text-body-sm font-medium disabled:opacity-40 hover:bg-ink-light transition-colors"
                >
                  {captureLoading ? "Processing…" : captureIntent === "download" ? "Download video" : captureIntent === "share" ? "Get share link" : captureIntent === "saveBrief" ? "Save brief" : "Render video"}
                </button>
              </motion.form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast for non-blocking errors */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md"
          >
            <div className="flex items-center gap-3 rounded-xl border border-warm/30 bg-white px-4 py-3 shadow-lg">
              <div className="w-5 h-5 rounded-full bg-warm-soft flex items-center justify-center shrink-0">
                <svg viewBox="0 0 16 16" className="w-3 h-3 text-warm" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 1v6M8 9v.5" />
                  <path d="M1.5 12.5L8 1.5l6.5 11H1.5z" />
                </svg>
              </div>
              <p className="text-body-xs text-ink flex-1">{toastMessage}</p>
              <button
                onClick={() => setToastMessage(null)}
                className="text-ink-faint hover:text-ink transition-colors shrink-0"
              >
                <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 3l6 6M9 3l-6 6" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <VoiceOverlay
        open={voiceOverlayOpen}
        mode={voiceOverlayMode}
        onClose={() => setVoiceOverlayOpen(false)}
        onComplete={handleVoiceComplete}
        onRequestSave={session?.authenticated ? undefined : handleVoiceRequestSave}
      />
    </>
  );
}

export default StudioClient;

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function VideoResultSection({ videoUrl }: { videoUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard?.writeText(videoUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-cream-dark bg-gradient-to-br from-white via-white to-success-soft/30 p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-success-soft flex items-center justify-center">
            <svg viewBox="0 0 16 16" className="w-4 h-4 text-success" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 8.5l3.5 3.5L13 5" />
            </svg>
          </div>
          <div>
            <h3 className="text-body-sm font-medium text-ink">HeyGen video ready</h3>
            <p className="text-body-xs text-ink-muted">Personalised video rendered for your recipient</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className={`btn-press inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-body-xs font-medium transition-[color,background-color,border-color,opacity,box-shadow,transform] ${
              copied
                ? "border-success/20 bg-success-soft text-success"
                : "border-cream-dark text-ink hover:bg-cream-dark/50"
            }`}
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-press inline-flex items-center gap-1.5 rounded-lg bg-ink text-cream px-3 py-2 text-body-xs font-medium hover:bg-ink-light transition-colors"
          >
            Open video
            <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </a>
        </div>
      </div>
      <div className="aspect-video w-full rounded-xl overflow-hidden bg-ink shadow-md">
        <video
          src={videoUrl}
          controls
          autoPlay
          muted
          playsInline
          className="w-full h-full object-contain"
        />
      </div>
    </motion.div>
  );
}
