"use client";

import { useState } from "react";
import { UrlForm } from "@/components/url-form";
import { ProgressStepper } from "@/components/progress-stepper";
import { ScriptReview } from "@/components/script-review";
import { VideoPlayer } from "@/components/video-player";
import { generateVideo } from "@/lib/pipeline";
import type { PipelineState } from "@/lib/pipeline";

export default function Home() {
  const [state, setState] = useState<PipelineState>({
    stage: "input",
    steps: [],
  });

  async function handleSubmit(urls: string[]) {
    await generateVideo(urls, setState);
  }

  function handleReset() {
    setState({ stage: "input", steps: [] });
  }

  function handleEditScript(script: string) {
    setState((prev) => ({ ...prev, script }));
  }

  async function handleRenderAfterEdit() {
    if (!state.script || !state.assetUrls) return;

    setState((prev) => ({
      ...prev,
      stage: "progress",
      steps: prev.steps.map((s) =>
        s.id === "video"
          ? { ...s, status: "active", elapsed: undefined }
          : s
      ),
    }));

    try {
      const videoRes = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: state.script,
          assetUrls: state.assetUrls,
        }),
      });
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

      setState((prev) => ({
        ...prev,
        stage: "done",
        videoUrl,
        steps: prev.steps.map((s) =>
          s.id === "video" ? { ...s, status: "complete", elapsed: 0 } : s
        ),
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        stage: "error",
        error: error instanceof Error ? error.message : "Video render failed",
      }));
    }
  }

  if (state.stage === "input") {
    return <UrlForm onSubmit={handleSubmit} />;
  }

  if (state.stage === "progress") {
    return <ProgressStepper steps={state.steps} />;
  }

  if (state.stage === "review" && state.script && state.profile) {
    return (
      <ScriptReview
        script={state.script}
        profile={state.profile}
        sources={state.sources}
        onEdit={handleEditScript}
        onRender={handleRenderAfterEdit}
      />
    );
  }

  if (state.stage === "done" && state.videoUrl) {
    return <VideoPlayer videoUrl={state.videoUrl} onReset={handleReset} />;
  }

  if (state.stage === "error") {
    return (
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-[600px] space-y-4 text-center">
          <p className="text-sm text-red-600">{state.error}</p>
          <button
            onClick={handleReset}
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            Start over →
          </button>
        </div>
      </main>
    );
  }

  return null;
}
