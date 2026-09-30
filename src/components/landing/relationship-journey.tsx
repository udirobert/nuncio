"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

type Stage = 1 | 2 | 3 | 4;
type Choice = "ask" | "request" | "time" | null;

const STAGES: { n: Stage; label: string }[] = [
  { n: 1, label: "First touch" },
  { n: 2, label: "Your choices" },
  { n: 3, label: "Request" },
  { n: 4, label: "Human call" },
];

const CHOICES: { id: Exclude<Choice, null>; label: string; desc: string }[] = [
  { id: "ask", label: "Ask the AI", desc: "Alex’s disclosed AI representative answers from his playbook." },
  { id: "request", label: "Request Alex", desc: "Ask Alex for a live call — he decides whether to join." },
  { id: "time", label: "Choose a time", desc: "Opens the sender’s scheduling link, when configured — not a native calendar." },
];

function Bubble({ who, children }: { who: "alex" | "maya" | "ai" | "system"; children: React.ReactNode }) {
  const styles =
    who === "maya"
      ? "bg-ink text-cream ml-auto"
      : who === "ai"
        ? "bg-accent-soft/60 border border-accent/20 text-ink"
        : who === "system"
          ? "bg-cream-dark/50 text-ink-muted text-center italic"
          : "bg-white border border-cream-dark text-ink";
  const name =
    who === "maya" ? "Maya" : who === "ai" ? "Alex’s AI representative" : who === "alex" ? "Alex" : "";
  return (
    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${styles}`}>
      {name && <p className="text-label-sm uppercase tracking-widest opacity-60 mb-0.5">{name}</p>}
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  );
}

export function RelationshipJourney() {
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>(1);
  const [choice, setChoice] = useState<Choice>(null);
  const [accepted, setAccepted] = useState(false);

  const pick = (s: Stage) => {
    setStage(s);
    if (s < 4) setAccepted(false);
    if (s === 1) setChoice(null);
  };

  const transition = reducedMotion ? { duration: 0 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const };
  const stageTitle = STAGES.find((s) => s.n === stage)?.label ?? "";

  return (
    <section
      id="prospect-experience"
      tabIndex={-1}
      aria-label="Illustrative prospect journey"
      className="scroll-mt-28 rounded-2xl border border-cream-dark bg-white/80 p-5 sm:p-6 space-y-4"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-label-sm uppercase tracking-widest text-ink-faint font-medium">
          Illustrative journey · not a live session
        </p>
        <p className="text-label-base text-ink-faint">Alex (sender) → Maya (prospect)</p>
      </div>

      <div className="flex items-center gap-0" role="group" aria-label="Journey stages">
        {STAGES.map((s, i) => (
          <div key={s.n} className="flex items-center flex-1 min-w-0">
            <button
              onClick={() => pick(s.n)}
              aria-pressed={stage === s.n}
              aria-label={`${s.n}. ${s.label}`}
              className={`btn-press flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors min-h-[44px] ${
                stage === s.n ? "bg-accent-soft text-accent" : "text-ink-muted hover:text-ink"
              }`}
            >
              <span
                aria-hidden
                className={`w-6 h-6 rounded-full flex items-center justify-center text-label-sm font-mono shrink-0 border ${
                  stage === s.n ? "bg-accent text-white border-accent" : "border-cream-dark text-ink-faint"
                }`}
              >
                {s.n}
              </span>
              <span aria-hidden className="text-label-base font-medium truncate hidden sm:inline">{s.label}</span>
            </button>
            {i < STAGES.length - 1 && <span aria-hidden className="flex-1 h-px bg-cream-dark mx-1 min-w-2" />}
          </div>
        ))}
      </div>

      <p className="text-sm font-medium text-ink">
        Stage {stage}: {stageTitle}
      </p>

      <motion.div
        key={`${stage}-${choice}-${accepted}`}
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition}
        className="rounded-xl border border-cream-dark bg-cream/40 p-4 space-y-2.5 min-h-[220px]"
      >
        {stage === 1 && (
          <>
            <Bubble who="alex">
              Maya, you mentioned onboarding delays. Would it help to talk through where the handoffs get stuck?
            </Bubble>
            <Bubble who="maya">Possibly. What would implementation involve?</Bubble>
            <Bubble who="ai">
              I’m Alex’s AI representative — I can answer from his playbook, or you can ask for Alex himself on this link.
            </Bubble>
            <button
              onClick={() => setStage(2)}
              className="btn-press rounded-lg bg-ink text-cream px-4 py-2.5 text-sm font-medium min-h-[44px]"
            >
              See Maya’s choices
            </button>
          </>
        )}

        {stage === 2 && (
          <>
            <p className="text-sm text-ink-muted">
              On the link, Maya chooses how to continue — no step is compulsory.{" "}
              <span className="text-ink-faint">Example: Alex is taking requests.</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {CHOICES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setChoice(c.id);
                    if (c.id === "request") setStage(3);
                  }}
                  aria-pressed={choice === c.id}
                  className={`btn-press rounded-xl border px-3 py-2.5 text-left transition-colors min-h-[44px] ${
                    choice === c.id ? "border-accent bg-accent-soft/50" : "border-cream-dark bg-white hover:bg-cream-soft"
                  }`}
                >
                  <span className="block text-sm font-medium text-ink">{c.label}</span>
                  <span className="block text-sm text-ink-faint mt-0.5 leading-snug">{c.desc}</span>
                </button>
              ))}
            </div>
            {choice === "ask" && (
              <div className="space-y-2.5 pt-1">
                <Bubble who="maya">What would implementation involve?</Bubble>
                <Bubble who="ai">
                  I’m Alex’s AI representative, not Alex. From his playbook: most teams pilot the handoff step first —
                  happy to answer here, or you can request Alex directly.
                </Bubble>
                <button
                  onClick={() => setStage(3)}
                  className="btn-press rounded-lg bg-ink text-cream px-4 py-2.5 text-sm font-medium min-h-[44px]"
                >
                  Request Alex
                </button>
              </div>
            )}
          </>
        )}

        {stage === 3 && (
          <>
            <Bubble who="system">Maya requests a call. Alex sees it and decides — nothing connects until he accepts.</Bubble>
            {!accepted ? (
              <button
                onClick={() => setAccepted(true)}
                className="btn-press rounded-lg bg-accent text-white px-4 py-2.5 text-sm font-medium min-h-[44px]"
              >
                Accept request (as Alex)
              </button>
            ) : (
              <div className="space-y-2.5">
                <Bubble who="system">Request accepted — Maya can join when ready.</Bubble>
                <p className="text-sm text-ink-muted">As Alex, you’re ready to join the room.</p>
                <button
                  onClick={() => setStage(4)}
                  className="btn-press rounded-lg bg-ink text-cream px-4 py-2.5 text-sm font-medium min-h-[44px]"
                >
                  Show both participants joining
                </button>
              </div>
            )}
          </>
        )}

        {stage === 4 && (
          <>
            <Bubble who="system">
              In this example, both participants have joined; if the AI was present it stepped aside.
            </Bubble>
            <div className="rounded-xl border border-ink/10 bg-ink/90 px-4 py-6 text-center">
              <p className="text-sm text-cream/80">Human call · Alex + Maya</p>
              <p className="text-label-base text-cream/50 mt-1">Illustration only — no real session is running.</p>
            </div>
          </>
        )}
      </motion.div>

      <p className="text-sm text-ink-faint">
        No AI qualification required. Human calls need availability and acceptance.
      </p>
    </section>
  );
}
