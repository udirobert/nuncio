"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Header } from "@/components/header";
import type { StudioBuildResult, StudioNode } from "@/lib/creative/melius-provider";

type StudioStage = "input" | "building" | "ready" | "error";

interface IteratingNode {
  nodeId: string;
  label: string;
  prompt: string;
}

export default function StudioPage() {
  const [url, setUrl] = useState("");
  const [senderBrief, setSenderBrief] = useState("");
  const [stage, setStage] = useState<StudioStage>("input");
  const [buildResult, setBuildResult] = useState<StudioBuildResult | null>(null);
  const [error, setError] = useState("");
  const [iterating, setIterating] = useState<IteratingNode | null>(null);
  const [buildingLog, setBuildingLog] = useState<string[]>([]);

  async function handleBuild() {
    if (!url.trim()) return;

    setStage("building");
    setBuildingLog(["Enriching profile...", "Synthesising context...", "Writing script...", "Building Melius canvas...", "Creating nodes...", "Wiring edges...", "Generating visuals..."]);

    try {
      const res = await fetch("/api/studio/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), senderBrief: senderBrief.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Build failed");
      }

      const result: StudioBuildResult = await res.json();
      setBuildResult(result);
      setStage("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("error");
    }
  }

  async function handleIterate(nodeId: string, newPrompt: string, label: string) {
    setIterating({ nodeId, label, prompt: newPrompt });

    try {
      const res = await fetch("/api/studio/iterate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId,
          prompt: newPrompt,
          canvasId: buildResult?.canvasId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Regeneration failed");
      }

      const { outputUrl, status } = await res.json();

      setBuildResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === nodeId
              ? { ...n, prompt: newPrompt, status: outputUrl ? "complete" : status === "running" ? "generating" : "failed", outputUrl }
              : n
          ),
        };
      });
    } catch (err) {
      console.error("Iteration failed:", err);
    } finally {
      setIterating(null);
    }
  }

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const isReady = stage === "ready";
  const canvasId = buildResult?.canvasId;

  useEffect(() => {
    if (!isReady || !canvasId) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/studio/canvas/${canvasId}`);
        if (!res.ok) return;
        const data = await res.json();

        setBuildResult((prev) => {
          if (!prev) return prev;
          const merged = prev.nodes.map((n) => {
            const updated = data.nodes.find((u: { id: string }) => u.id === n.id);
            return updated ? { ...n, status: updated.status, outputUrl: updated.outputUrl } : n;
          });
          const done = merged.every((n) => n.status === "complete" || n.status === "failed");
          if (done && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          return { ...prev, nodes: merged };
        });
      } catch {
        // ignore poll errors
      }
    }, 5000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isReady, canvasId]);

  return (
    <>
      <Header stage={stage === "ready" ? "review" : stage === "building" ? "progress" : "input"} />

      <main className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {stage === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto space-y-8 pt-16"
            >
              <div className="text-center space-y-3">
                <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight">
                  Melius Studio
                </h1>
                <p className="text-ink-muted text-sm max-w-md mx-auto">
                  Paste a profile URL and watch an agent build a complete Melius canvas — text nodes, image generation, wired edges, all visible.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-ink-muted block mb-1.5">
                    Profile URL
                  </label>
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full rounded-xl border border-cream-dark bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                    onKeyDown={(e) => e.key === "Enter" && handleBuild()}
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[
                      { label: "LinkedIn", url: "https://linkedin.com/in/sundarpichai" },
                      { label: "X / Twitter", url: "https://x.com/sundarpichai" },
                    ].map((example) => (
                      <button
                        key={example.label}
                        onClick={() => { setUrl(example.url); }}
                        className="text-[11px] text-ink-faint hover:text-accent transition-colors px-2 py-1 rounded-md border border-cream-dark/50 hover:border-accent/30"
                      >
                        Try {example.label} →
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-ink-muted block mb-1.5">
                    Sender brief <span className="text-ink-faint">(optional)</span>
                  </label>
                  <textarea
                    value={senderBrief}
                    onChange={(e) => setSenderBrief(e.target.value)}
                    placeholder="e.g. I'm building nuncio and would love feedback..."
                    rows={2}
                    className="w-full rounded-xl border border-cream-dark bg-white px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                  />
                </div>

                <button
                  onClick={handleBuild}
                  disabled={!url.trim()}
                  className="btn-press w-full rounded-xl bg-ink text-cream py-3 text-sm font-medium disabled:opacity-40 hover:bg-ink-light transition-colors"
                >
                  Build Melius canvas →
                </button>
              </div>
            </motion.div>
          )}

          {stage === "building" && (
            <motion.div
              key="building"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-lg mx-auto pt-24 text-center space-y-6"
            >
              <div className="w-12 h-12 rounded-full border-2 border-accent/30 border-t-accent animate-spin mx-auto" />
              <div className="space-y-2">
                {buildingLog.map((msg, i) => (
                  <motion.p
                    key={msg}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.3 }}
                    className="text-sm text-ink-muted"
                  >
                    {msg}
                  </motion.p>
                ))}
              </div>
            </motion.div>
          )}

          {stage === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md mx-auto pt-24 text-center space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-error-soft flex items-center justify-center mx-auto">
                <svg viewBox="0 0 16 16" className="w-5 h-5 text-error" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3.5M8 10.5v.5" />
                </svg>
              </div>
              <p className="text-sm text-ink-light">{error}</p>
              <button
                onClick={() => setStage("input")}
                className="btn-press rounded-xl border border-cream-dark px-5 py-3 text-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors"
              >
                Try again
              </button>
            </motion.div>
          )}

          {stage === "ready" && buildResult && (
            <motion.div
              key="ready"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
                    Melius Canvas
                  </h1>
                  <p className="text-xs text-ink-muted mt-1">
                    Canvas ID: {buildResult.canvasId.slice(0, 8)}…
                    <a
                      href={buildResult.canvasUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline ml-2"
                    >
                      Open in Melius →
                    </a>
                  </p>
                </div>
                <button
                  onClick={() => { setStage("input"); setBuildResult(null); }}
                  className="text-xs text-ink-faint hover:text-ink transition-colors"
                >
                  New canvas
                </button>
              </div>

              {/* Two-column layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Canvas embed */}
                <div className="rounded-2xl border border-cream-dark bg-white overflow-hidden aspect-video">
                  <iframe
                    src={buildResult.embedUrl}
                    className="w-full h-full"
                    allow="clipboard-read; clipboard-write"
                    title="Melius Canvas"
                  />
                </div>

                {/* Right: Node list */}
                <div className="space-y-3">
                  <h2 className="text-xs font-medium text-ink-faint uppercase tracking-wider">
                    Nodes ({buildResult.nodes.length})
                  </h2>

                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {buildResult.nodes.map((node) => (
                      <NodeCard
                        key={node.id}
                        node={node}
                        isIterating={iterating?.nodeId === node.id}
                        onRegenerate={(prompt) => handleIterate(node.id, prompt, node.label)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <a
                  href={buildResult.canvasUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-press inline-flex items-center gap-2 rounded-xl border border-cream-dark px-4 py-2.5 text-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors"
                >
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M6 2L2 6v8h12V2H6zM2 6h4V2" />
                  </svg>
                  Open in Melius
                </a>
                <button
                  onClick={() => setStage("input")}
                  className="btn-press rounded-xl bg-ink text-cream px-4 py-2.5 text-sm font-medium hover:bg-ink-light transition-colors"
                >
                  Build another →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}

function NodeCard({
  node,
  isIterating,
  onRegenerate,
}: {
  node: StudioNode;
  isIterating: boolean;
  onRegenerate: (prompt: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState(node.prompt || "");

  const typeColor = node.type === "image" ? "text-warm" : node.type === "custom_text" ? "text-accent" : "text-ink-muted";

  return (
    <div className="rounded-xl border border-cream-dark bg-white p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs shrink-0">{statusIcon(node.status)}</span>
          <span className={`text-xs font-mono uppercase ${typeColor}`}>{node.type}</span>
          <span className="text-sm font-medium text-ink truncate">{node.label}</span>
        </div>
        {node.type === "image" && (
          <button
            onClick={() => { setEditing(!editing); setEditPrompt(node.prompt || ""); }}
            className="text-[11px] text-ink-faint hover:text-accent transition-colors shrink-0"
          >
            {editing ? "Done" : "Edit"}
          </button>
        )}
      </div>

      {node.outputUrl && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-success font-medium">Generated</span>
          <a
            href={node.outputUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-accent hover:underline truncate"
          >
            View output →
          </a>
        </div>
      )}

      {node.prompt && !editing && (
        <p className="text-xs text-ink-muted leading-relaxed line-clamp-2">{node.prompt}</p>
      )}

      {editing && (
        <div className="space-y-2">
          <textarea
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-cream-dark bg-cream/50 px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => { onRegenerate(editPrompt); setEditing(false); }}
              disabled={isIterating || !editPrompt.trim()}
              className="btn-press rounded-lg bg-accent text-white px-3 py-1.5 text-[11px] font-medium disabled:opacity-40 hover:bg-accent/90 transition-colors"
            >
              {isIterating ? "Generating..." : "Regenerate"}
            </button>
            <span className="text-[10px] text-ink-faint">
              Updates the prompt and re-runs the model
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function statusIcon(status: StudioNode["status"]) {
  switch (status) {
    case "complete": return <span className="text-success">✓</span>;
    case "generating": return <span className="animate-pulse text-accent">◌</span>;
    case "failed": return <span className="text-error">✗</span>;
    default: return <span className="text-ink-faint">○</span>;
  }
}
