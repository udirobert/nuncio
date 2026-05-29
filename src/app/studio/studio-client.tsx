"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { FormEvent, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import type { VideoCustomization, HeyGenAvatar, HeyGenVoice } from "@/lib/heygen";
import { VideoCustomization as VideoCustomizationComponent } from "@/components/video-customization";
import { OnboardingModal } from "@/components/onboarding-modal";
import { LANGUAGES } from "@/lib/languages";
import { QuickInput } from "./quick-input";
import { QuickReview } from "./quick-review";
import { QuickProgress } from "./quick-progress";
import type { QuickProgressStep } from "./quick-progress";
import { QuickReady } from "./quick-ready";
import { VoiceOverlay } from "@/components/voice-overlay";
import type { VoiceProfileResult } from "@/components/voice-overlay";
import { DeepResearchToggle } from "@/components/deep-research-toggle";
import { QualityLadder } from "@/components/quality-ladder";
import type { UserPlan } from "@/components/quality-ladder";

export type StudioStage = "input" | "enriching" | "review" | "building" | "ready" | "error";
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
}

function StudioClient({ initialAvatars, initialVoices }: StudioClientProps) {
  const [quickMode, setQuickMode] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("nuncio_studio_mode") !== "advanced";
    return true;
  });
  const [showProgressDetails, setShowProgressDetails] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showAdvancedInput, setShowAdvancedInput] = useState(false);
  const [scriptEditing, setScriptEditing] = useState(false);
  const [url, setUrl] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("nuncio_studio_bridge");
        if (stored) {
          const data = JSON.parse(stored);
          sessionStorage.removeItem("nuncio_studio_bridge");
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
          sessionStorage.removeItem("nuncio_studio_bridge");
          return data.brief || "";
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
  const [videoComposed, setVideoComposed] = useState(false);
  const [videoCustomization, setVideoCustomization] = useState<VideoCustomization | undefined>();
  const [showCustomization, setShowCustomization] = useState(false);

  // Wait screen context
  const [recentActivity, setRecentActivity] = useState<string | undefined>();
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

  const searchParams = useSearchParams();

  const senderBriefRef = useRef(senderBrief);
  senderBriefRef.current = senderBrief;

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
        if (data.plan) {
          setUserPlan(data.plan as UserPlan);
        }
      })
      .catch(() => {});
  }, [searchParams]);

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

  function saveSenderMemory() {
    const brief = senderBrief.trim();
    const name = senderName.trim();
    const business = senderBusiness.trim();
    const brand = senderBrand.trim();
    const personality = senderPersonality.trim();
    const audience = senderAudience.trim();
    const offer = senderOffer.trim();
    const proofPoints = senderProofPoints.trim();
    if (!brief && !name && !business && !brand && !personality && !audience && !offer && !proofPoints) return;
    fetch("/api/account/brief", {
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
      }),
    }).catch(() => {});
    if (name) localStorage.setItem("nuncio_sender_name", name);
    if (business) localStorage.setItem("nuncio_sender_business", business);
    if (brand) localStorage.setItem("nuncio_sender_brand", brand);
    if (personality) localStorage.setItem("nuncio_sender_personality", personality);
    if (audience) localStorage.setItem("nuncio_sender_audience", audience);
    if (offer) localStorage.setItem("nuncio_sender_offer", offer);
    if (proofPoints) localStorage.setItem("nuncio_sender_proof_points", proofPoints);
  }

  function toggleMode() {
    const next = !quickMode;
    setQuickMode(next);
    localStorage.setItem("nuncio_studio_mode", next ? "quick" : "advanced");
  }

  function handleVoiceComplete(profile: VoiceProfileResult) {
    const populated = new Set<string>();
    if (profile.url) { setUrl(profile.url); populated.add("url"); }
    if (profile.senderName) { setSenderName(profile.senderName); populated.add("senderName"); }
    if (profile.senderBrief) { setSenderBrief(profile.senderBrief); populated.add("senderBrief"); }
    if (profile.archetype) setArchetype(profile.archetype as ArchetypeSelection);
    if (profile.tone) setTonePreference(profile.tone);
    setVoiceBrief(profile);
    setVoicePopulatedFields(populated);
    setVoiceOverlayOpen(false);
    setTimeout(() => setVoicePopulatedFields(new Set()), 3000);
  }

  function handleVoiceRequestSave(profile: VoiceProfileResult) {
    // Store the brief temporarily, then show email capture
    const populated = new Set<string>();
    if (profile.url) populated.add("url");
    if (profile.senderName) populated.add("senderName");
    if (profile.senderBrief) populated.add("senderBrief");
    setVoiceBrief(profile);
    setVoicePopulatedFields(populated);
    setVoiceOverlayOpen(false);
    setTimeout(() => setVoicePopulatedFields(new Set()), 3000);
    // Open email capture with "saveBrief" context
    setCaptureIntent("saveBrief" as CaptureIntent);
    setCaptureError("");
    setCaptureEmail("");
  }

  async function handleEnrich() {
    if (!url.trim()) return;
    setStage("enriching");
    setPipelineStep("enrich");
    setError("");
    saveSenderMemory();

    try {
      const res = await fetch("/api/studio/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          senderName: senderName.trim() || undefined,
          senderBrief: senderBrief.trim() || undefined,
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
          intent: archetype === "auto" ? undefined : undefined,
          archetype: archetype === "auto" ? undefined : archetype,
          scriptVariants: !quickMode,
          researchTier: researchTier !== "quick" ? researchTier : undefined,
          deepResearchEnabled: deepResearchEnabled || undefined,
          language: translateEnabled ? (detectedLanguage || undefined) : "en",
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        let msg = "Enrichment failed";
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
            } else if (event.insufficientCredits) {
              setInsufficientCredits({ required: event.requiredCredits, available: event.availableCredits });
              throw new Error(event.error);
            } else if (event.error) {
              throw new Error(event.error);
            } else if (event.type === "done") {
              const data = event.result;
              setReviewProfile(data.profile);
              setReviewScript(typeof data.script === "string" ? data.script : "");
              setReviewScriptVariantA(data.scriptVariantA || null);
              setReviewScriptVariantB(data.scriptVariantB || null);
              setReviewSelectedVariant("a");
              setReviewHook(data.hook);
              if (data.recentActivity) setRecentActivity(data.recentActivity);
              // Refresh balance from server after credits were spent
              if (typeof event.creditsBalance === "number") {
                setSession((prev) => prev ? { ...prev, balance: event.creditsBalance } : prev);
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
      setError(err instanceof Error ? err.message : "Enrichment failed");
      setPipelineStep("idle");
      setStage("error");
    }
  }

  async function handleRegenerate() {
    if (!reviewProfile) return;
    setReviewRegenerating(true);
    setPipelineStep("compose");
    try {
      const res = await fetch("/api/studio/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          senderName: senderName.trim() || undefined,
          senderBrief: senderBrief.trim() || undefined,
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
          profile: reviewProfile,
          scriptVariants: !quickMode,
          language: translateEnabled ? (reviewProfile.language || undefined) : "en",
        }),
      });

      if (!res.ok) return;

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
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch { /* keep current script */ }
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
      }
    } catch (error) {
      console.error("[tts] Preview failed:", error);
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
      }
    } catch (error) {
      console.error("[audio-memo] Generation failed:", error);
    }
    setAudioMemoLoading(false);
  }

  async function handleConfirmBuild() {
    if (!reviewProfile || !reviewScript) return;
    if (!capturedEmail) {
      openCapture("render");
      return;
    }
    saveSenderMemory();
    setStage("building");
    setBuildStep("build");
    setBuildStartedAt(Date.now());
    setBuildElapsedSeconds(0);
    setShowHookReasoning(false);
    const rendered = await handleRenderVideo(capturedEmail);
    if (!rendered) {
      setStage("error");
      return;
    }
    setBuildResult({});
    setStage("ready");
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not capture email");
      }

      setCapturedEmail(data.email);
      setShareUrl(data.shareUrl || "");
      setCaptureIntent(null);

      if (captureIntent === "share" && data.shareUrl) {
        await copyShareUrl(data.shareUrl);
      } else if (captureIntent === "download") {
        openDownloadTarget();
      } else if (captureIntent === "render") {
        await handleRenderVideo(data.email);
      } else if (captureIntent === "saveBrief") {
        // Fill studio from the voice brief that was captured
        const profile = voiceBrief;
        if (profile) {
          if (profile.url) setUrl(profile.url);
          if (profile.senderName) setSenderName(profile.senderName);
          if (profile.senderBrief) setSenderBrief(profile.senderBrief);
          if (profile.archetype) setArchetype(profile.archetype as ArchetypeSelection);
          if (profile.tone) setTonePreference(profile.tone);
        }
      }
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCaptureLoading(false);
    }
  }

  async function handleShareClick() {
    if (!capturedEmail || !shareUrl) {
      openCapture("share");
      return;
    }
    await copyShareUrl(shareUrl);
  }

  async function handleDownloadClick() {
    if (!capturedEmail) {
      openCapture("download");
      return;
    }
    if (videoRenderResult?.videoUrl) {
      window.open(videoRenderResult.videoUrl, "_blank", "noopener,noreferrer");
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
        throw new Error("Video render timed out — it may still be running.");
      }

      setVideoRenderResult({ videoUrl, videoId });
      setVideoRendering("done");

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
      <Header stage={stage === "ready" ? "review" : (stage === "building" || stage === "enriching") ? "progress" : stage === "review" ? "review" : "input"} />
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
                  <p className="text-sm font-medium text-ink">Credits added!</p>
                  <p className="text-[11px] text-ink-muted">
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
          {stage === "input" && (quickMode ? (
            <QuickInput
              key="quick-input"
              url={url}
              setUrl={setUrl}
              senderName={senderName}
              setSenderName={setSenderName}
              senderBrief={senderBrief}
              setSenderBrief={setSenderBrief}
              senderBusiness={senderBusiness}
              setSenderBusiness={setSenderBusiness}
              outreachGoal={outreachGoal}
              setOutreachGoal={setOutreachGoal}
              onEnrich={handleEnrich}
              onToggleMode={toggleMode}
              onOpenVoice={() => setVoiceOverlayOpen(true)}
              detectedLanguage={detectedLanguage}
              detectingLanguage={detectingLanguage}
              translateEnabled={translateEnabled}
              onToggleTranslate={() => setTranslateEnabled(!translateEnabled)}
              voicePopulatedFields={voicePopulatedFields}
            />
          ) : (
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
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-soft border border-accent/15">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                        <span className="text-[10px] uppercase tracking-widest font-medium text-accent">
                          AI-powered · personalised video
                        </span>
                      </div>
                      <button
                        onClick={toggleMode}
                        className="text-[11px] text-ink-faint hover:text-accent transition-colors"
                      >
                        Switch to Quick mode
                      </button>
                    </div>
                    <h1 className="font-[family-name:var(--font-display)] text-5xl lg:text-6xl tracking-tight leading-[1.02]">
                      Brief an agent.
                      <br />
                      <span className="text-ink-muted">Get personalised creative.</span>
                    </h1>
                    <p className="text-ink-muted text-base max-w-md mx-auto leading-relaxed">
                      Drop in a profile URL. A nuncio agent reads the human, generates a personalised outreach script, and renders a custom video for you.
                    </p>
                    <Link
                      href="/batch"
                      className="text-[11px] text-accent hover:text-accent/80 transition-colors inline-block"
                    >
                      Need to reach multiple people? Try Batch →
                    </Link>

                    <div className="space-y-3 text-left">
                      <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent-soft/60 via-white to-warm-soft/30 p-4 shadow-sm space-y-3">
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
                              <p className="text-sm font-medium text-ink">Talk to your video agent</p>
                              <span className="rounded-full bg-white/70 border border-accent/15 px-2 py-0.5 text-[9px] uppercase tracking-widest text-accent">
                                Speech Engine
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                              Say who you want to reach and why. Nuncio interviews you, extracts the brief, then fills this studio for you.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setVoiceOverlayOpen(true)}
                          className="btn-press w-full rounded-xl bg-accent text-white py-3 text-sm font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
                        >
                          Start voice brief
                          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 8h10M9 4l4 4-4 4" />
                          </svg>
                        </button>
                      </div>

                      {voiceBrief && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-2xl border border-success/20 bg-success-soft/40 p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-ink">Voice brief captured</p>
                              <p className="text-xs text-ink-muted">Review the extracted campaign context before researching.</p>
                            </div>
                            <button
                              onClick={() => setVoiceOverlayOpen(true)}
                              className="text-[11px] text-success hover:text-success/80 transition-colors"
                            >
                              Re-record
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {voiceBrief.name && (
                              <div className="rounded-xl bg-white/70 border border-success/10 p-2">
                                <span className="block text-[9px] uppercase tracking-widest text-ink-faint">Recipient</span>
                                <span className="text-ink">{voiceBrief.name}</span>
                              </div>
                            )}
                            {(voiceBrief.company || voiceBrief.role) && (
                              <div className="rounded-xl bg-white/70 border border-success/10 p-2">
                                <span className="block text-[9px] uppercase tracking-widest text-ink-faint">Context</span>
                                <span className="text-ink">{[voiceBrief.role, voiceBrief.company].filter(Boolean).join(" · ")}</span>
                              </div>
                            )}
                            {voiceBrief.tone && (
                              <div className="rounded-xl bg-white/70 border border-success/10 p-2">
                                <span className="block text-[9px] uppercase tracking-widest text-ink-faint">Tone</span>
                                <span className="text-ink capitalize">{voiceBrief.tone}</span>
                              </div>
                            )}
                            {voiceBrief.archetype && (
                              <div className="rounded-xl bg-white/70 border border-success/10 p-2">
                                <span className="block text-[9px] uppercase tracking-widest text-ink-faint">Hook</span>
                                <span className="text-ink">{ARCHETYPE_OPTIONS.find((option) => option.id === voiceBrief.archetype)?.label || voiceBrief.archetype}</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}

                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
                          Profile URL
                        </label>
                        <input
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="https://linkedin.com/in/…"
                          className={`w-full rounded-xl border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all ${voicePopulatedFields.has("url") ? "border-success/50" : "border-cream-dark"}`}
                          onKeyDown={(e) => e.key === "Enter" && handleEnrich()}
                        />
                        {voicePopulatedFields.has("url") && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-success">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Set by voice
                          </span>
                        )}
                          <div className="flex flex-wrap gap-2 mt-2">
                          {[
                            { label: "Sundar Pichai", url: "https://linkedin.com/in/sundarpichai" },
                            { label: "Vercel CEO", url: "https://x.com/rauchg" },
                            { label: "Sundar Pichai", url: "https://linkedin.com/in/sundarpichai" },
                            { label: "Vercel CEO", url: "https://x.com/rauchg" },
                          ].map((example) => (
                            <button
                              key={example.label}
                              onClick={() => setUrl(example.url)}
                              className="text-[11px] text-ink-muted hover:text-accent transition-colors px-2.5 py-1 rounded-md border border-cream-dark/70 hover:border-accent/30 bg-white/60"
                            >
                              Try {example.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
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
                            className={`w-full rounded-xl border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all ${voicePopulatedFields.has("senderName") ? "border-success/50" : "border-cream-dark"}`}
                          />
                          {voicePopulatedFields.has("senderName") && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-success">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Set by voice
                            </span>
                          )}
                        </div>

                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
                            Brief <span className="normal-case text-ink-faint">— optional, but the agent uses it</span>
                          </label>
                          <textarea
                            value={senderBrief}
                            onChange={(e) => setSenderBrief(e.target.value)}
                            placeholder="What are you reaching out for? The more honest, the better."
                            rows={2}
                            className={`w-full rounded-xl border bg-white px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all ${voicePopulatedFields.has("senderBrief") ? "border-success/50" : "border-cream-dark"}`}
                          />
                          {voicePopulatedFields.has("senderBrief") && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-success">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Set by voice
                            </span>
                          )}
                        </div>

                      {/* Advanced settings — collapsed by default */}
                      <div className="pt-2">
                        <button
                          onClick={() => setShowAdvancedInput(!showAdvancedInput)}
                          className="text-[11px] text-ink-faint hover:text-accent transition-colors flex items-center gap-1.5"
                        >
                          <svg viewBox="0 0 16 16" className={`w-3.5 h-3.5 transition-transform ${showAdvancedInput ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M6 4l4 4-4 4" />
                          </svg>
                          Advanced settings
                        </button>

                        {showAdvancedInput && (
                          <div className="mt-3 space-y-3 pl-4 border-l-2 border-cream-dark">
                            <div>
                              <label className="text-[10px] uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
                                Hook archetype
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {ARCHETYPE_OPTIONS.map((option) => (
                                  <div key={option.id} className="flex flex-col">
                                    <button
                                      onClick={() => setArchetype(option.id)}
                                      className={`rounded-md border px-2.5 py-1 text-[11px] transition-colors ${
                                        archetype === option.id
                                          ? "border-accent bg-accent-soft text-accent"
                                          : "border-cream-dark/70 bg-white/60 text-ink-muted hover:border-accent/30 hover:text-accent"
                                      }`}
                                    >
                                      {option.label}
                                    </button>
                                    {archetype === option.id && (
                                      <span className="text-[10px] text-ink-muted mt-1 max-w-[160px] leading-relaxed">
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

                      </div>
                    )}
                  </div>

                {detectingLanguage && (
                  <span className="text-[10px] text-ink-faint animate-pulse block text-center">
                    Detecting language…
                  </span>
                )}
                {detectedLanguage && !detectingLanguage && (
                  <div className="rounded-xl border border-warm/20 bg-warm-soft/40 p-3 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-ink-muted">
                      {detectedLanguage === "en" ? "English detected." : `${detectedLanguage.toUpperCase()} detected. Script stays English unless you choose otherwise.`}
                    </span>
                    {detectedLanguage !== "en" && (
                      <button
                        onClick={() => setTranslateEnabled(!translateEnabled)}
                        className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-medium transition-colors ${
                          translateEnabled ? "bg-warm text-white" : "bg-white text-warm border border-warm/20"
                        }`}
                      >
                        {translateEnabled ? `Using ${detectedLanguage.toUpperCase()}` : `Use ${detectedLanguage.toUpperCase()}`}
                      </button>
                    )}
                  </div>
                )}

                <button
                  onClick={handleEnrich}
                  disabled={!url.trim()}
                  className="btn-press w-full rounded-xl bg-ink text-cream py-3.5 text-sm font-medium disabled:opacity-40 hover:bg-ink-light transition-colors flex items-center justify-center gap-2"
                >
                  Research & write script
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </button>
                {session?.authenticated && typeof session.balance === "number" && (
                  <div className="flex items-center justify-between text-[10px] text-ink-faint mt-1.5 px-1">
                    <span>
                      Estimated cost: {researchTier === "deep" ? "~11" : researchTier === "balanced" ? "~8" : "~3"} credits
                      {" · "}Full video: {researchTier === "deep" ? "~19" : researchTier === "balanced" ? "~16" : "~11"}
                    </span>
                    <span className={session.balance < 11 ? "text-warm font-medium" : ""}>
                      {session.balance} available
                    </span>
                  </div>
                )}
                  </div>
                </div>
                </div>
              </section>

            </motion.div>
          ))}

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
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  <span className="text-[10px] uppercase tracking-widest font-medium text-accent">
                    Researching
                  </span>
                </div>
                <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
                  Reading their profile
                </h1>
                <p className="text-sm text-ink-muted mt-2">
                  Three agents working together to research and personalise your video.
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
                      className={`flex items-center gap-4 rounded-xl border p-4 transition-all duration-500 ${
                        active
                          ? "border-accent/30 bg-accent-soft shadow-sm"
                          : complete
                            ? "border-cream-dark bg-cream-soft"
                            : "border-cream-dark bg-white opacity-50"
                      }`}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-medium transition-all duration-500">
                        {complete ? (
                          <svg className="w-4 h-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : active ? (
                          <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium transition-colors ${
                            active ? "text-accent" : complete ? "text-ink" : "text-ink-muted"
                          }`}>
                            {step.label}
                          </span>
                          <span className="text-[10px] font-mono text-ink-faint">{step.tool}</span>
                        </div>
                        <p className={`text-xs mt-0.5 transition-colors ${
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

          {/* ─── REVIEW ──────────────────────────────────────────────── */}
          {stage === "review" && reviewProfile && (quickMode ? (
            <QuickReview
              key="quick-review"
              profile={reviewProfile}
              script={reviewScript}
              senderName={senderName}
              onBuild={handleConfirmBuild}
              onRegenerate={handleRegenerate}
              onBack={() => setStage("input")}
              onToggleMode={toggleMode}
              regenerating={reviewRegenerating}
              translateEnabled={translateEnabled}
              onToggleTranslate={() => setTranslateEnabled(!translateEnabled)}
              onLanguageChange={(code) => {
                setReviewProfile(prev => prev ? { ...prev, language: code } : prev);
              }}
            />
          ) : (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-6 pt-24 pb-16 max-w-3xl mx-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success-soft border border-success/15">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  <span className="text-[10px] uppercase tracking-widest font-medium text-success">
                    Review
                  </span>
                </div>
                <button
                  onClick={toggleMode}
                  className="text-[11px] text-ink-faint hover:text-accent transition-colors"
                >
                  Switch to Quick mode
                </button>
              </div>
              <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
                Review the script
              </h1>
              <p className="text-sm text-ink-muted mt-2 mb-8">
                Edit anything below, then build the final video.
              </p>

              <div className="space-y-6">
                {/* Profile card — collapsed by default */}
                <div className="rounded-xl border border-cream-dark bg-white p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-widest font-medium text-ink-muted">Profile</div>
                    <button
                      onClick={() => setShowProfileEditor(!showProfileEditor)}
                      className="text-[11px] text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
                    >
                      {showProfileEditor ? "Collapse" : "Edit details"}
                      <svg viewBox="0 0 16 16" className={`w-3 h-3 transition-transform ${showProfileEditor ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M4 6l4 4 4-4" />
                      </svg>
                    </button>
                  </div>
                  <div>
                    <p className="text-sm text-ink font-medium">{reviewProfile.name}</p>
                    <p className="text-xs text-ink-muted">
                      {[reviewProfile.current_role, reviewProfile.company && `at ${reviewProfile.company}`].filter(Boolean).join(" ") || "No role detected"}
                    </p>
                  </div>

                  {showProfileEditor && (
                    <>
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-cream-dark">
                        <div>
                          <label className="text-[10px] text-ink-faint block mb-1">Name</label>
                          <input
                            type="text"
                            value={reviewProfile.name}
                            onChange={(e) => setReviewProfile({ ...reviewProfile, name: e.target.value })}
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-ink-faint block mb-1">Company</label>
                          <input
                            type="text"
                            value={reviewProfile.company}
                            onChange={(e) => setReviewProfile({ ...reviewProfile, company: e.target.value })}
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] text-ink-faint block mb-1">Role</label>
                          <input
                            type="text"
                            value={reviewProfile.current_role}
                            onChange={(e) => setReviewProfile({ ...reviewProfile, current_role: e.target.value })}
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-cream-dark">
                        <div>
                          <label className="text-[10px] text-ink-faint block mb-1">Your business</label>
                          <input
                            type="text"
                            value={senderBusiness}
                            onChange={(e) => setSenderBusiness(e.target.value)}
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-ink-faint block mb-1">Brand</label>
                          <input
                            type="text"
                            value={senderBrand}
                            onChange={(e) => setSenderBrand(e.target.value)}
                            placeholder="e.g. thoughtful, technical, premium"
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-ink-faint block mb-1">Personality</label>
                          <input
                            type="text"
                            value={senderPersonality}
                            onChange={(e) => setSenderPersonality(e.target.value)}
                            placeholder="e.g. founder-led, direct, curious"
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-ink-faint block mb-1">Audience / ICP</label>
                          <input
                            type="text"
                            value={senderAudience}
                            onChange={(e) => setSenderAudience(e.target.value)}
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-ink-faint block mb-1">Offer</label>
                          <input
                            type="text"
                            value={senderOffer}
                            onChange={(e) => setSenderOffer(e.target.value)}
                            placeholder="What are you offering this person?"
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-ink-faint block mb-1">Goal</label>
                          <input
                            type="text"
                            value={outreachGoal}
                            onChange={(e) => setOutreachGoal(e.target.value)}
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-ink-faint block mb-1">Desired outcome</label>
                          <input
                            type="text"
                            value={desiredOutcome}
                            onChange={(e) => setDesiredOutcome(e.target.value)}
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-ink-faint block mb-1">Relationship</label>
                          <select
                            value={relationshipWarmth}
                            onChange={(e) => setRelationshipWarmth(e.target.value as "cold" | "warm" | "existing")}
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
                          >
                            <option value="cold">Cold</option>
                            <option value="warm">Warm</option>
                            <option value="existing">Existing</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-ink-faint block mb-1">Tone preference</label>
                          <input
                            type="text"
                            value={tonePreference}
                            onChange={(e) => setTonePreference(e.target.value)}
                            placeholder="e.g. warm, crisp, bold"
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-ink-faint block mb-1">Why now</label>
                          <textarea
                            value={reasonForReachingOutNow}
                            onChange={(e) => setReasonForReachingOutNow(e.target.value)}
                            rows={2}
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-ink-faint block mb-1">Proof points</label>
                          <textarea
                            value={senderProofPoints}
                            onChange={(e) => setSenderProofPoints(e.target.value)}
                            rows={3}
                            placeholder="One per line: traction, customers, credibility, outcomes"
                            className="w-full rounded-lg border border-cream-dark px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </div>
                      </div>

                      {/* Tone selector */}
                      <div>
                        <label className="text-[10px] text-ink-faint block mb-2">Tone</label>
                        <div className="flex gap-2">
                          {(["conversational", "formal", "technical"] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => setReviewProfile({ ...reviewProfile, tone: t })}
                              className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${
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
                          <label className="text-[10px] text-ink-faint block">
                            Language
                            <span className="ml-1.5 text-warm">(auto-detected)</span>
                          </label>
                          <label className="flex items-center gap-1.5 text-[10px] text-ink-faint cursor-pointer select-none">
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
                          className="w-full rounded-lg border border-cream-dark px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
                        >
                          {LANGUAGES.map((l) => (
                            <option key={l.code} value={l.code}>{l.label}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>

                {/* Script */}
                <div className="rounded-xl border border-cream-dark bg-white p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="text-[10px] uppercase tracking-widest font-medium text-ink-muted">Script</div>
                      <button
                        onClick={() => setScriptEditing(!scriptEditing)}
                        className="text-[11px] text-accent hover:text-accent/80 transition-colors"
                      >
                        {scriptEditing ? "Done" : "Edit"}
                      </button>
                    </div>
                    <button
                      onClick={handleRegenerate}
                      disabled={reviewRegenerating}
                      className="text-[11px] text-accent hover:text-accent/80 disabled:opacity-50 flex items-center gap-1"
                    >
                      {reviewRegenerating ? (
                        <span className="w-3 h-3 border border-accent/30 border-t-accent rounded-full animate-spin" />
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
                        className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
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
                        className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
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
                      className="w-full rounded-lg border border-cream-dark px-3 py-2 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  ) : (
                    <div className="w-full rounded-lg border border-cream-dark/50 bg-cream/30 px-3 py-3 text-sm leading-relaxed text-ink whitespace-pre-wrap">
                      {reviewScript}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-ink-faint">
                      {reviewScript.split(/\s+/).filter(Boolean).length} words · ~{Math.round(reviewScript.split(/\s+/).filter(Boolean).length / 2.5)}s at natural pace
                    </p>
                    <button
                      onClick={handleTtsPreview}
                      disabled={ttsLoading || !reviewScript.trim()}
                      className="text-[11px] text-accent hover:text-accent/80 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                    >
                      {ttsLoading ? (
                        <span className="w-3 h-3 border border-accent/30 border-t-accent rounded-full animate-spin" />
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
                        <span className="px-2 py-0.5 rounded bg-warm-soft border border-warm/20 text-[11px] text-warm font-medium">
                          {reviewHook.archetype}
                        </span>
                        <span className="text-xs text-ink-muted">{reviewHook.format}</span>
                      </div>
                      <svg viewBox="0 0 16 16" className={`w-3.5 h-3.5 text-ink-faint transition-transform ${showHookReasoning ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M4 6l4 4 4-4" />
                      </svg>
                    </button>
                    {showHookReasoning && (
                      <div className="px-4 pb-4">
                        <p className="text-xs text-ink-muted leading-relaxed">{reviewHook.reasoning}</p>
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
                      <span className="text-xs font-medium text-ink">Customize avatar & voice</span>
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
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Actions — sticky */}
                <div className="sticky bottom-4 z-10 bg-gradient-to-t from-cream via-cream/95 to-transparent pt-6 pb-2 -mx-6 px-6 space-y-2">
                  {session?.authenticated && typeof session.balance === "number" && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-ink-faint">{session.balance} credits remaining</span>
                        <span className="text-ink-faint">Render: 8 · Soundscape: 1</span>
                      </div>
                      {session.balance < 9 && (
                        <div className="flex items-center justify-between rounded-lg bg-warm-soft/50 border border-warm/15 px-3 py-2">
                          <span className="text-[11px] text-warm font-medium">Low balance — you need 9 credits to render</span>
                          <a href="/pricing" className="text-[10px] text-accent font-bold uppercase tracking-widest hover:text-accent/80 transition-colors">
                            Top up
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setStage("input")}
                      className="flex-1 rounded-xl border border-cream-dark bg-white py-3 text-sm font-medium text-ink-muted hover:border-ink/30 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleConfirmBuild}
                      className="flex-[2] btn-press rounded-xl bg-ink text-cream py-3 text-sm font-medium hover:bg-ink-light transition-colors flex items-center justify-center gap-2 shadow-lg"
                    >
                      Build final video
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 8h10M9 4l4 4-4 4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

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
                  <p className="text-sm text-ink-muted">
                    This action needs <span className="font-semibold text-ink">{insufficientCredits.required} credits</span> but you have <span className="font-semibold text-ink">{insufficientCredits.available}</span>.
                  </p>
                  <div className="rounded-xl border border-cream-dark bg-white p-4 space-y-3 text-left">
                    <p className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">Top up options</p>
                    <a
                      href="/pricing"
                      className="btn-press flex items-center justify-between rounded-xl bg-ink text-cream px-4 py-3 text-sm font-medium hover:bg-ink-light transition-colors"
                    >
                      <span>Get Pro — 200 credits/month</span>
                      <span className="text-cream/60">$39/mo</span>
                    </a>
                    <a
                      href="/pricing#packs"
                      className="btn-press flex items-center justify-between rounded-xl border border-cream-dark px-4 py-3 text-sm font-medium text-ink hover:bg-cream-dark/30 transition-colors"
                    >
                      <span>Buy a credit pack</span>
                      <span className="text-ink-faint">from $15</span>
                    </a>
                  </div>
                  <button
                    onClick={() => { setInsufficientCredits(null); setStage("input"); }}
                    className="text-[11px] text-ink-faint hover:text-accent transition-colors"
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
                  <p className="text-sm text-ink-light">{error}</p>
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    <button
                      onClick={() => setStage("input")}
                      className="btn-press rounded-xl border border-cream-dark px-5 py-3 text-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors"
                    >
                      Try again
                    </button>
                    {error.toLowerCase().includes("login wall") || error.toLowerCase().includes("could not access") ? (
                      <button
                        onClick={() => { setUrl(""); setStage("input"); }}
                        className="btn-press rounded-xl border border-cream-dark px-5 py-3 text-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors"
                      >
                        Try a different URL
                      </button>
                    ) : !quickMode ? (
                      <button
                        onClick={() => { toggleMode(); setStage("input"); }}
                        className="btn-press rounded-xl border border-cream-dark px-5 py-3 text-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors"
                      >
                        Switch to Quick mode
                      </button>
                    ) : null}
                  </div>
                  {(error.toLowerCase().includes("login wall") || error.toLowerCase().includes("could not access")) && (
                    <p className="text-[11px] text-ink-faint">
                      Tip: some platforms block automated access. Try a LinkedIn profile or public blog.
                    </p>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ─── READY ────────────────────────────────────────────────── */}
          {stage === "ready" && buildResult && (quickMode ? (
            <QuickReady
              key="quick-ready"
              videoUrl={videoRenderResult?.videoUrl}
              videoRendering={videoRendering}
              videoComposed={videoComposed}
              onRenderVideo={() => {
                if (!capturedEmail) { openCapture("render"); } else { handleRenderVideo(); }
              }}
              onShare={handleShareClick}
              onDownload={handleDownloadClick}
              onReset={() => {
                setStage("input");
                setBuildResult(null);
                setUrl("");
                setSenderBrief("");
                setArchetype("auto");
                setShareUrl("");
                setShowHookReasoning(false);
                setVideoRendering("idle");
                setVideoRenderResult(null);
                setVideoComposed(false);
              }}
              onToggleMode={toggleMode}
              shareUrl={shareUrl}
            />
          ) : (
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
                    <span className="text-[10px] uppercase tracking-widest font-medium text-success">
                      Creative ready
                    </span>
                  </div>
                  <button
                    onClick={toggleMode}
                    className="text-[11px] text-ink-faint hover:text-accent transition-colors ml-auto"
                  >
                    Quick mode
                  </button>
                  <p className="text-sm text-ink">
                    {videoRendering === "done"
                      ? <>Video rendered successfully.</>
                      : <>Rendering in progress…</>}
                  </p>
                </div>

                <div className="border-t border-cream-dark/50 pt-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        if (!capturedEmail) { openCapture("render"); } else { handleRenderVideo(); }
                      }}
                      disabled={videoRendering === "rendering"}
                      className="btn-press inline-flex items-center gap-2 rounded-xl bg-ink text-cream px-5 py-3 text-sm font-medium hover:bg-ink-light transition-colors shadow-sm disabled:opacity-40"
                    >
                      {videoRendering === "rendering" ? "Rendering…" : videoRendering === "done" ? "Video ready" : "Render video"}
                    </button>

                    <span className="w-px h-8 bg-cream-dark" />

                    <button
                      onClick={handleShareClick}
                      className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-cream-dark px-3 py-2.5 text-xs font-medium text-ink-muted hover:bg-cream-dark/50 transition-colors"
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
                      className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-accent/20 bg-accent-soft/50 px-3 py-2.5 text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
                    >
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 4h12v10H2zM2 4l6 5 6-5M5 2h6" />
                      </svg>
                      Send to all
                    </a>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleAudioMemo}
                      disabled={audioMemoLoading}
                      className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-cream-dark px-2.5 py-1.5 text-[11px] text-ink-faint hover:text-ink-muted hover:bg-cream-dark/30 transition-colors disabled:opacity-50"
                      title="Generate a voice memo teaser to send as a DM hook"
                    >
                      {audioMemoLoading ? (
                        <span className="w-3 h-3 border border-accent/30 border-t-accent rounded-full animate-spin" />
                      ) : (
                        <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M8 2v8M5 6v4a3 3 0 006 0V6" />
                          <path d="M3 8a5 5 0 0010 0M8 13v2" />
                        </svg>
                      )}
                      {audioMemoUrl ? "Memo ready" : "Audio memo"}
                    </button>

                    <div className="flex-1" />

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
                        setVideoComposed(false);
                      }}
                      className="btn-press rounded-lg border border-cream-dark px-2.5 py-1.5 text-[11px] text-ink-faint hover:text-ink-muted hover:bg-cream-dark/30 transition-colors"
                    >
                      Brief another →
                    </button>
                  </div>
                </div>

                {/* Audio memo player */}
                {audioMemoUrl && (
                  <div className="rounded-xl border border-accent/20 bg-accent-soft/30 p-4 flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-[10px] uppercase tracking-widest font-medium text-accent mb-1">Audio Memo Ready</p>
                      <p className="text-[11px] text-ink-muted">Send this as a DM teaser before sharing the full video link.</p>
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
                    <p className="text-[10px] uppercase tracking-widest font-medium text-ink-faint">
                      Your {draftMessage.channel} draft
                    </p>
                    <div className="rounded-lg bg-cream-dark/30 p-3 text-xs text-ink-light leading-relaxed whitespace-pre-wrap">
                      {draftMessage.message}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(draftMessage.message);
                      }}
                      className="text-[11px] text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
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
                <div className="border-t border-cream-dark/50 pt-3">
                  <button
                    onClick={() => { setShowCustomization(true); setStage("review"); }}
                    className="text-[11px] text-ink-faint hover:text-accent transition-colors flex items-center gap-1.5"
                  >
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="8" cy="5" r="3" />
                      <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" />
                    </svg>
                    Change avatar or voice & re-render
                  </button>
                </div>
              </div>

              {/* Video result */}
              {videoRenderResult && videoRendering === "done" && (
                <VideoResultSection videoUrl={videoRenderResult.videoUrl} />
              )}
            </motion.div>
          ))}
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
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest ${meta.chipClass}`}
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
                    className="font-[family-name:var(--font-display)] text-3xl tracking-tight"
                  >
                    {captureIntent === "download" ? "Download video" : captureIntent === "share" ? "Share video" : captureIntent === "saveBrief" ? "Save your brief" : "Render video"}
                  </motion.h2>
                </div>
                <button
                  onClick={() => setCaptureIntent(null)}
                  className="rounded-lg border border-cream-dark px-2 py-1 text-xs text-ink-muted hover:text-ink hover:bg-cream/60 transition-colors"
                >
                  Close
                </button>
              </div>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="text-sm text-ink-muted leading-relaxed mb-5"
              >
                {captureIntent === "download" && "Enter your email and we'll send you a download link for your video."}
                {captureIntent === "share" && "Enter your email and we'll send you a shareable link you can copy."}
                {captureIntent === "render" && "Enter your email and we'll render your video. We'll notify you when it's ready."}
                {captureIntent === "saveBrief" && "Enter your email to save this brief to your account. We'll also send you a shareable link."}
                {!session?.authenticated && (
                  <span className="block mt-2 text-xs text-accent">
                    Free account includes 10 starter credits. Go Pro for 200 credits/month.
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
                  <label className="text-[10px] uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={captureEmail}
                    onChange={(e) => setCaptureEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-xl border border-cream-dark bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                    autoFocus
                  />
                </div>

                {captureError && (
                  <p className="text-xs text-error">{captureError}</p>
                )}

                <button
                  type="submit"
                  disabled={captureLoading || !captureEmail.trim()}
                  className="btn-press w-full rounded-xl bg-ink text-cream py-3.5 text-sm font-medium disabled:opacity-40 hover:bg-ink-light transition-colors"
                >
                  {captureLoading ? "Processing…" : captureIntent === "download" ? "Download video" : captureIntent === "share" ? "Get share link" : captureIntent === "saveBrief" ? "Save brief" : "Render video"}
                </button>
              </motion.form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <VoiceOverlay
        open={voiceOverlayOpen}
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
            <h3 className="text-sm font-medium text-ink">HeyGen video ready</h3>
            <p className="text-xs text-ink-muted">Personalised video rendered for your recipient</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className={`btn-press inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
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
            className="btn-press inline-flex items-center gap-1.5 rounded-lg bg-ink text-cream px-3 py-2 text-xs font-medium hover:bg-ink-light transition-colors"
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
