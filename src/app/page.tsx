"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Header } from "@/components/header";
import { UrlForm } from "@/components/url-form";
import { ProgressStepper } from "@/components/progress-stepper";
import { ScriptReview } from "@/components/script-review";
import { VideoPlayer } from "@/components/video-player";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ShowcaseStrip } from "@/components/landing/showcase-strip";
import { VideoProof } from "@/components/landing/video-proof";
import { generateVideo, renderVideo, continueAfterCoach, isDemoMode } from "@/lib/pipeline";
import { SHOWCASE_RECIPIENTS } from "@/lib/showcase";
import type { PipelineState } from "@/lib/pipeline";
import { AnglePicker } from "@/components/angle-picker";
import type { IntentId } from "@/components/intent-chips";

export default function Home() {
  const [state, setState] = useState<PipelineState>({
    stage: "input",
    steps: [],
  });

  async function handleSubmit(
    urls: string[],
    senderBrief?: string,
    intent?: IntentId,
  ) {
    await generateVideo(urls, setState, senderBrief, intent);
  }

  function handleReset() {
    setState({ stage: "input", steps: [] });
  }

  function handleEditScript(script: string) {
    setState((prev) => ({ ...prev, script }));
  }

  async function handleRender() {
    if (!state.script) return;
    await renderVideo(
      state.script,
      state.assetUrls || [],
      setState,
      state.profile?.name,
      {
        profile: state.profile,
        sources: state.sources,
        canvas: state.canvas,
        trace: state.trace,
      }
    );
  }

  return (
    <>
      <Header stage={state.stage} isDemo={state.isDemo || isDemoMode()} />

      <AnimatePresence mode="wait">
        {state.stage === "input" && (
          <motion.div
            key="input"
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col"
          >
            <Hero>
              <UrlForm onSubmit={handleSubmit} />
            </Hero>
            <VideoProof />
            <ShowcaseStrip items={SHOWCASE_RECIPIENTS} />
            <HowItWorks />
          </motion.div>
        )}

        {state.stage === "progress" && (
          <motion.div
            key="progress"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col"
          >
            <ProgressStepper steps={state.steps} warnings={state.warnings} urls={state.urls} />
          </motion.div>
        )}

        {state.stage === "coach" && state.profile && (
          <motion.div
            key="coach"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col"
          >
            <AnglePicker
              profile={state.profile}
              onConfirm={(selectedAngles) => {
                continueAfterCoach(
                  setState,
                  state.enrichedMarkdown,
                  state.senderBrief,
                  state.intent,
                  selectedAngles
                );
              }}
              onSkip={() => {
                continueAfterCoach(
                  setState,
                  state.enrichedMarkdown,
                  state.senderBrief,
                  state.intent
                );
              }}
            />
          </motion.div>
        )}

        {state.stage === "review" && state.script && state.profile && (
          <motion.div
            key="review"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col"
          >
            <ScriptReview
              script={state.script}
              profile={state.profile}
              sources={state.sources}
              canvas={state.canvas}
              trace={state.trace}
              onEdit={handleEditScript}
              onRender={handleRender}
            />
          </motion.div>
        )}

        {state.stage === "done" && state.videoUrl && (
          <motion.div
            key="done"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col"
          >
            <VideoPlayer
              videoUrl={state.videoUrl}
              videoId={state.videoId}
              shareId={state.share?.id}
              canvas={state.canvas}
              trace={state.trace}
              captions={state.captions}
              onReset={handleReset}
              recipientName={state.profile?.name}
            />
          </motion.div>
        )}

        {state.stage === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="flex-1 flex items-center justify-center px-6"
          >
            <div className="w-full max-w-[540px] text-center space-y-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="w-12 h-12 rounded-full bg-error-soft flex items-center justify-center mx-auto"
              >
                <svg viewBox="0 0 16 16" className="w-5 h-5 text-error" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3.5M8 10.5v.5" />
                </svg>
              </motion.div>
              <div>
                <p className="text-sm text-ink-light mb-1">{state.error}</p>
                <p className="text-xs text-ink-faint">
                  This can happen with rate limits or inaccessible profiles.
                </p>
              </div>
              <button
                onClick={handleReset}
                className="btn-press inline-flex items-center gap-2 rounded-2xl border border-cream-dark px-5 py-3.5 text-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors"
              >
                Try again
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
