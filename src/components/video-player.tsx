"use client";

import { useState } from "react";

interface VideoPlayerProps {
  videoUrl: string;
  onReset: () => void;
}

export function VideoPlayer({ videoUrl, onReset }: VideoPlayerProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(videoUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-[600px] space-y-6">
        <h1 className="text-2xl font-medium tracking-tight">
          ✓ Your video is ready
        </h1>

        <div className="aspect-video w-full rounded-lg overflow-hidden bg-neutral-900">
          <video
            src={videoUrl}
            controls
            autoPlay
            muted
            playsInline
            className="w-full h-full object-contain"
          >
            <track kind="captions" />
          </video>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            className="flex-1 rounded-md border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
          <a
            href={videoUrl}
            download
            className="flex-1 rounded-md border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-50 text-center"
          >
            Download
          </a>
        </div>

        <button
          onClick={onReset}
          className="block w-full text-center text-sm text-neutral-500 hover:text-neutral-900"
        >
          Generate another →
        </button>
      </div>
    </main>
  );
}
