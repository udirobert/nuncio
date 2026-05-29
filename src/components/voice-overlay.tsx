"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Conversation } from "@elevenlabs/client";

export interface VoiceProfileResult {
  name?: string;
  company?: string;
  role?: string;
  url?: string;
  senderName?: string;
  senderBrief?: string;
  archetype?: string;
  tone?: string;
}

interface VoiceOverlayProps {
  open: boolean;
  onClose: () => void;
  onComplete: (profile: VoiceProfileResult) => void;
  /** If provided, called instead of onComplete when profile is captured. Parent can show email capture, then call onComplete. */
  onRequestSave?: (profile: VoiceProfileResult) => void;
}

type Status = "idle" | "connecting" | "listening" | "speaking" | "extracting" | "editing" | "error";

interface ChecklistField {
  key: keyof VoiceProfileResult;
  label: string;
  required: boolean;
}

const CHECKLIST_FIELDS: ChecklistField[] = [
  { key: "name", label: "Recipient", required: true },
  { key: "company", label: "Company", required: false },
  { key: "senderName", label: "Your name", required: true },
  { key: "senderBrief", label: "Reason", required: true },
  { key: "tone", label: "Tone", required: false },
  { key: "url", label: "Profile link", required: false },
];

export function VoiceOverlay({ open, onClose, onComplete, onRequestSave }: VoiceOverlayProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [transcripts, setTranscripts] = useState<{ role: "user" | "agent"; text: string }[]>([]);
  const [error, setError] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [editProfile, setEditProfile] = useState<VoiceProfileResult>({});
  const [extracting, setExtracting] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const conversationRef = useRef<Awaited<ReturnType<typeof Conversation.startSession>> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  // Catch SDK internal unhandled rejections
  useEffect(() => {
    function handleUnhandledRejection(e: PromiseRejectionEvent) {
      const reason = e.reason;
      if (typeof reason === "object" && reason !== null) {
        const msg = reason.message || reason.toString?.() || "Voice connection error";
        if (msg.includes("error_type") || msg.includes("DataChannel") || msg.includes("webrtc") || msg.includes("room")) {
          e.preventDefault();
          console.warn("[voice-overlay] Caught SDK error:", reason);
          setError("Voice connection interrupted. Please try again.");
          setStatus("error");
          conversationRef.current?.endSession().catch(() => {});
          conversationRef.current = null;
        }
      }
    }
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  }, []);

  function handleClose() {
    conversationRef.current?.endSession().catch(() => {});
    conversationRef.current = null;
    setStatus("idle");
    setTranscripts([]);
    setError("");
    setLinkUrl("");
    setEditProfile({});
    setTurnCount(0);
    onClose();
  }

  const startVoice = useCallback(async () => {
    setError("");
    setEditProfile({});
    setStatus("connecting");
    setTranscripts([]);
    setTurnCount(0);

    try {
      const tokenRes = await fetch("/api/studio/voice/token");
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({}));
        throw new Error(body.error || "Voice server unavailable");
      }
      const tokenData = await tokenRes.json();
      const signedUrl = tokenData.signed_url;

      if (!signedUrl) {
        throw new Error("No signed URL received from voice server");
      }

      console.log("[voice] starting session with signedUrl");
      const conversation = await Conversation.startSession({
        signedUrl,
        onMessage: (msg) => {
          if (msg.role === "agent") {
            setTranscripts((prev) => [...prev, { role: "agent", text: msg.message }]);
          } else {
            setTranscripts((prev) => [...prev, { role: "user", text: msg.message }]);
            setTurnCount((c) => c + 1);
          }
        },
        onModeChange: ({ mode }) => {
          setStatus(mode === "speaking" ? "speaking" : "listening");
        },
        onError: (msg: unknown) => {
          const text = typeof msg === "string" ? msg : msg instanceof Error ? msg.message : JSON.stringify(msg);
          setError(text || "Voice connection error");
          setStatus("error");
        },
        onDisconnect: () => {
          setStatus((current) => {
            if (current === "editing" || current === "extracting") return current;
            if (current === "connecting" || current === "listening" || current === "speaking") {
              // Agent ended the conversation naturally — trigger extraction
              handleExtract();
              return "extracting";
            }
            return "idle";
          });
        },
      });

      conversationRef.current = conversation;
      setStatus("listening");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect");
      setStatus("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleExtract() {
    setExtracting(true);
    setStatus("extracting");
    // End the conversation if still active
    conversationRef.current?.endSession().catch(() => {});
    conversationRef.current = null;

    try {
      const res = await fetch("/api/studio/voice/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcripts, linkUrl: linkUrl.trim() || undefined }),
      });

      if (!res.ok) throw new Error("Extraction failed");
      const profile = await res.json();

      // Merge link URL
      if (linkUrl.trim()) profile.url = linkUrl.trim();

      setEditProfile(profile);
      setStatus("editing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not extract brief");
      setStatus("error");
    } finally {
      setExtracting(false);
    }
  }

  function handleConfirm() {
    const profile = { ...editProfile };
    if (linkUrl.trim() && !profile.url) profile.url = linkUrl.trim();

    if (onRequestSave) {
      onRequestSave(profile);
    } else {
      onComplete(profile);
    }
    handleClose();
  }

  // Heuristic detection of mentioned fields from transcript
  const detectedFields = useDetectedFields(transcripts, linkUrl);

  const isActive = status === "listening" || status === "speaking" || status === "connecting";
  const showDoneButton = isActive && turnCount >= 2;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-3xl rounded-3xl border border-cream-dark bg-white shadow-[0_24px_80px_-24px_rgba(0,0,0,0.35)] overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* ─── EDITING STATE ─── */}
            {status === "editing" ? (
              <EditCard
                profile={editProfile}
                onChange={setEditProfile}
                linkUrl={linkUrl}
                onLinkChange={setLinkUrl}
                onConfirm={handleConfirm}
                onRedo={() => { setEditProfile({}); setStatus("idle"); }}
                onClose={handleClose}
              />
            ) : (
              /* ─── CONVERSATION STATE ─── */
              <div className="grid md:grid-cols-[1fr,1.2fr] flex-1 min-h-0">
                {/* Left panel — mic + progress */}
                <div className="relative bg-gradient-to-br from-accent-soft via-white to-warm-soft p-5 flex flex-col justify-between min-h-[340px]">
                  <button
                    onClick={handleClose}
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-white/50 transition-colors z-10"
                  >
                    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                  </button>

                  {/* Header */}
                  <div className="space-y-2 pr-8">
                    <div className="inline-flex items-center gap-2 rounded-full border border-accent/15 bg-white/70 px-2.5 py-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        status === "error" ? "bg-error" :
                        status === "extracting" ? "bg-warm animate-pulse" :
                        isActive ? "bg-accent animate-pulse" :
                        "bg-ink-faint"
                      }`} />
                      <span className="text-[10px] uppercase tracking-widest font-medium text-accent">
                        Voice brief
                      </span>
                    </div>
                    <p className="text-sm text-ink-muted leading-relaxed">
                      Tell me who to reach, why, and your name. I&apos;ll fill the studio.
                    </p>
                  </div>

                  {/* Mic button */}
                  <div className="flex flex-col items-center gap-3 my-4">
                    <div className={`relative w-24 h-24 rounded-full flex items-center justify-center ${
                      status === "speaking" ? "bg-warm-soft" :
                      status === "listening" ? "bg-success-soft" :
                      status === "error" ? "bg-error-soft" :
                      "bg-accent-soft"
                    }`}>
                      {isActive && (
                        <>
                          <span className="absolute inset-0 rounded-full bg-accent/10 animate-ping" />
                          <span className="absolute inset-3 rounded-full bg-accent/10 animate-pulse" />
                        </>
                      )}
                      <button
                        onClick={status === "idle" || status === "error" ? startVoice : undefined}
                        disabled={status === "connecting" || status === "extracting"}
                        className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg disabled:opacity-40 ${
                          isActive
                            ? "bg-accent text-white"
                            : "bg-accent text-white hover:bg-accent/90"
                        }`}
                      >
                        {status === "extracting" ? (
                          <svg viewBox="0 0 16 16" className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="8" cy="8" r="6" strokeDasharray="24" strokeDashoffset="8" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 16 16" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M8 2v8M5 6v4a3 3 0 006 0V6" />
                            <path d="M3 8a5 5 0 0010 0M8 13v2" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-ink-muted text-center">
                      {status === "idle" && "Tap to start"}
                      {status === "connecting" && "Connecting..."}
                      {status === "listening" && "Listening"}
                      {status === "speaking" && "Agent speaking"}
                      {status === "extracting" && "Extracting brief..."}
                      {status === "error" && (error || "Connection error")}
                    </p>
                  </div>

                  {/* Progress checklist */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">Gathering</p>
                    {CHECKLIST_FIELDS.map((field) => {
                      const detected = detectedFields.has(field.key);
                      return (
                        <div key={field.key} className="flex items-center gap-2">
                          <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            detected ? "border-success bg-success/10" : "border-cream-dark"
                          }`}>
                            {detected && (
                              <svg viewBox="0 0 12 12" className="w-2 h-2 text-success" fill="currentColor">
                                <path d="M10.28 2.22a.75.75 0 0 1 0 1.06l-6 6a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 1.06-1.06L3.75 7.69l5.47-5.47a.75.75 0 0 1 1.06 0z" />
                              </svg>
                            )}
                          </span>
                          <span className={`text-xs ${detected ? "text-ink" : "text-ink-faint"}`}>
                            {field.label}
                            {field.required && !detected && <span className="text-accent ml-0.5">*</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right panel — transcript + link + done */}
                <div className="p-4 flex flex-col min-h-0">
                  {/* Transcript */}
                  <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 rounded-2xl border border-cream-dark bg-cream/40 p-3 min-h-[180px] max-h-[280px]">
                    {transcripts.length === 0 && (
                      <p className="text-xs text-ink-faint text-center py-16">
                        Press the mic to begin your voice brief.
                      </p>
                    )}
                    {transcripts.map((t, i) => (
                      <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                          t.role === "user"
                            ? "bg-accent text-white rounded-br-sm"
                            : "bg-white border border-cream-dark text-ink rounded-bl-sm"
                        }`}>
                          {t.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Link paste input */}
                  <div className="mt-3">
                    <label className="text-[10px] uppercase tracking-widest text-ink-faint font-medium block mb-1">
                      Paste profile link (optional)
                    </label>
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://linkedin.com/in/..."
                      className="w-full rounded-xl border border-cream-dark bg-cream/30 px-3 py-2 text-sm text-ink placeholder:text-ink-faint/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/30"
                    />
                  </div>

                  {/* Done button */}
                  {showDoneButton && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3"
                    >
                      <button
                        onClick={handleExtract}
                        disabled={extracting}
                        className="w-full btn-press rounded-xl bg-ink text-cream py-3 text-sm font-medium hover:bg-ink-light transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
                      >
                        {extracting ? "Extracting..." : "Done \u2014 fill studio"}
                        {!extracting && (
                          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 8h10M9 4l4 4-4 4" />
                          </svg>
                        )}
                      </button>
                    </motion.div>
                  )}

                  {/* Idle/error retry */}
                  {status === "error" && (
                    <button
                      onClick={startVoice}
                      className="mt-3 w-full rounded-xl border border-cream-dark py-2.5 text-sm font-medium text-ink-muted hover:border-ink/30 transition-colors"
                    >
                      Try again
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Edit Card (post-extraction) ──────────────────────────────────────────────

interface EditCardProps {
  profile: VoiceProfileResult;
  onChange: (p: VoiceProfileResult) => void;
  linkUrl: string;
  onLinkChange: (v: string) => void;
  onConfirm: () => void;
  onRedo: () => void;
  onClose: () => void;
}

function EditCard({ profile, onChange, linkUrl, onLinkChange, onConfirm, onRedo, onClose }: EditCardProps) {
  function updateField(key: keyof VoiceProfileResult, value: string) {
    onChange({ ...profile, [key]: value });
  }

  const toneOptions = ["conversational", "formal", "technical"];
  const archetypeOptions = [
    { id: "auto", label: "Auto" },
    { id: "mirror", label: "Mirror" },
    { id: "origin", label: "Origin" },
    { id: "future_cast", label: "Future-cast" },
    { id: "inside_joke", label: "Inside joke" },
    { id: "day_in_the_life", label: "Day-in-life" },
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success" />
          <h3 className="font-[family-name:var(--font-display)] text-xl text-ink">
            Review your brief
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-cream/60 transition-colors"
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      <p className="text-sm text-ink-muted">
        Edit any fields below before filling the studio. Fix transcription errors here.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <EditField label="Recipient name" value={profile.name || ""} onChange={(v) => updateField("name", v)} />
        <EditField label="Company" value={profile.company || ""} onChange={(v) => updateField("company", v)} />
        <EditField label="Role" value={profile.role || ""} onChange={(v) => updateField("role", v)} />
        <EditField label="Your name" value={profile.senderName || ""} onChange={(v) => updateField("senderName", v)} />
      </div>

      <EditField
        label="Reason for outreach"
        value={profile.senderBrief || ""}
        onChange={(v) => updateField("senderBrief", v)}
        multiline
      />

      <EditField
        label="Profile link"
        value={profile.url || linkUrl}
        onChange={(v) => { updateField("url", v); onLinkChange(v); }}
        placeholder="https://linkedin.com/in/..."
      />

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-ink-faint font-medium block mb-1">Tone</label>
          <select
            value={profile.tone || "conversational"}
            onChange={(e) => updateField("tone", e.target.value)}
            className="w-full rounded-xl border border-cream-dark px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            {toneOptions.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-ink-faint font-medium block mb-1">Hook style</label>
          <select
            value={profile.archetype || "auto"}
            onChange={(e) => updateField("archetype", e.target.value)}
            className="w-full rounded-xl border border-cream-dark px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            {archetypeOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onRedo}
          className="flex-1 rounded-xl border border-cream-dark py-3 text-sm font-medium text-ink-muted hover:border-ink/30 transition-colors"
        >
          Re-do conversation
        </button>
        <button
          onClick={onConfirm}
          className="flex-[2] btn-press rounded-xl bg-ink text-cream py-3 text-sm font-medium hover:bg-ink-light transition-colors flex items-center justify-center gap-2 shadow-lg"
        >
          Fill studio
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Edit Field ───────────────────────────────────────────────────────────────

function EditField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const cls = "w-full rounded-xl border border-cream-dark px-3 py-2 text-sm text-ink placeholder:text-ink-faint/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/30 bg-white";
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest text-ink-faint font-medium block mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className={cls + " resize-none"}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </div>
  );
}

// ─── Heuristic field detection ────────────────────────────────────────────────

function useDetectedFields(
  transcripts: { role: "user" | "agent"; text: string }[],
  linkUrl: string
): Set<keyof VoiceProfileResult> {
  return useMemo(() => {
    const fields = new Set<keyof VoiceProfileResult>();
    const fullText = transcripts.map((t) => t.text).join(" ").toLowerCase();
    const userText = transcripts.filter((t) => t.role === "user").map((t) => t.text).join(" ");

    // Name detection: agent confirms a name like "So [Name]..." or user mentions a person
    if (/\b(reaching out to|video for|message to|contact)\b/i.test(fullText) && /[A-Z][a-z]+ [A-Z][a-z]+/.test(userText)) {
      fields.add("name");
    }
    // Company
    if (/\b(works at|at |company|platform|team at)\b/i.test(fullText) && userText.length > 20) {
      fields.add("company");
    }
    // Sender name: "my name is" or agent confirms sender
    if (/\b(my name is|i'm |i am |call me)\b/i.test(userText.toLowerCase())) {
      fields.add("senderName");
    }
    // Brief/reason
    if (/\b(because|want to|reaching out|program|partnership|introduce|follow up|pitch)\b/i.test(userText.toLowerCase())) {
      fields.add("senderBrief");
    }
    // Tone
    if (/\b(formal|casual|warm|friendly|technical|professional|conversational|partner-to-partner|founder)\b/i.test(fullText)) {
      fields.add("tone");
    }
    // URL
    if (linkUrl.trim() || /https?:\/\//i.test(userText)) {
      fields.add("url");
    }

    return fields;
  }, [transcripts, linkUrl]);
}
