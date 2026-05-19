"use client";

import { useState, useEffect, useRef, Suspense, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import type { StudioBuildResult, StudioNode } from "@/lib/creative/melius-provider";

type StudioStage = "input" | "building" | "ready" | "error";

interface IteratingNode {
  nodeId: string;
  label: string;
  prompt: string;
}

interface AgentLogEntry {
  id: string;
  phase: "enrich" | "synthesise" | "canvas" | "nodes" | "edges" | "generate";
  tool?: string;
  message: string;
  detail?: string;
  ts: number;
}

const DEMO_CANVAS_ID = "demo-canvas-001";

const DEMO_NODES: StudioNode[] = [
  { id: "n1", label: "Profile Summary", type: "custom_text", status: "complete", prompt: "Sundar Pichai — CEO of Google and Alphabet. IIT Kharagpur → Stanford → McKinsey → Google (2004). Led Chrome, Android, AI. Calm operator, long-horizon thinker, frames AI as foundational technology." },
  { id: "n2", label: "Script", type: "custom_text", status: "complete", prompt: "Hi Sundar — I built nuncio because I kept watching outreach automation strip the human signal out of every message. So I flipped it: an agent reads your work, then briefs Melius to build the canvas a human would have built…" },
  { id: "n3", label: "Visual Direction", type: "custom_text", status: "complete", prompt: "Tone: calm, thoughtful, technically credible. Palette: muted indigo / warm neutrals. Avoid stock corporate. Avoid faces. 16:9. Subtle motion only." },
  { id: "n4", label: "Outreach Objective", type: "custom_text", status: "complete", prompt: "Pitch nuncio as an example of agent-orchestrated Melius workflows. Ask: would Google ship something built this way?" },
  { id: "n5", label: "Video Background", type: "image", status: "complete", prompt: "Cinematic 16:9 background — soft gradient mesh in indigo and warm taupe, faint hex grid, abstract glow suggesting AI infrastructure. No text. No faces." },
  { id: "n6", label: "Video Thumbnail", type: "image", status: "complete", prompt: "16:9 thumbnail — minimal, single warm light source, slight grain. Implies a personalised message ready to play." },
];

const DEMO_BUILD_RESULT: StudioBuildResult = {
  projectId: "demo-project-001",
  canvasId: DEMO_CANVAS_ID,
  canvasUrl: "https://app.melius.com/canvas/demo",
  embedUrl: "about:blank",
  nodes: DEMO_NODES,
};

const DEMO_LAYOUT_NODES: {
  x: number; y: number; w: number; h: number;
  label: string;
  type: "custom_text" | "image";
  edgesIn?: number[];
}[] = [
  { x: 20,  y: 20,  w: 360, h: 140, label: "Profile Summary",    type: "custom_text" },
  { x: 20,  y: 175, w: 360, h: 200, label: "Script",             type: "custom_text" },
  { x: 20,  y: 390, w: 360, h: 140, label: "Visual Direction",   type: "custom_text" },
  { x: 20,  y: 545, w: 360, h: 100, label: "Outreach Objective", type: "custom_text" },
  { x: 420, y: 20,  w: 360, h: 230, label: "Video Background",   type: "image", edgesIn: [0, 2] },
  { x: 420, y: 265, w: 360, h: 230, label: "Video Thumbnail",    type: "image", edgesIn: [0, 2] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Animated mini-canvas — used as ambient hero preview AND building-stage stage
// ─────────────────────────────────────────────────────────────────────────────
function AgentCanvas({
  appearedCount,
  edgeCount,
  scale = 1,
  showCursor = false,
  cursorTarget,
}: {
  appearedCount: number;     // how many nodes are visible
  edgeCount: number;         // how many edges are wired
  scale?: number;
  showCursor?: boolean;
  cursorTarget?: { x: number; y: number };
}) {
  const allEdges = DEMO_LAYOUT_NODES.flatMap((n, ti) =>
    (n.edgesIn || []).map((si) => ({ source: si, target: ti }))
  );
  const visibleEdges = allEdges.slice(0, edgeCount);

  return (
    <div className="w-full h-full bg-[#e8e4dd] relative overflow-hidden">
      {/* Grid */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-25">
        <defs>
          <pattern id="agent-grid" width={20 * scale} height={20 * scale} patternUnits="userSpaceOnUse">
            <path d={`M ${20 * scale} 0 L 0 0 0 ${20 * scale}`} fill="none" stroke="#8b7f6f" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#agent-grid)" />
      </svg>

      {/* Canvas chrome */}
      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur rounded-lg px-2.5 py-1 shadow-sm border border-cream-dark z-30">
        <span className="text-[10px] font-mono text-ink-faint">melius • nuncio agent session</span>
      </div>
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/90 backdrop-blur rounded-full px-2.5 py-1 shadow-sm border border-cream-dark z-30">
        <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
        <span className="text-[10px] font-mono text-ink-faint">agent online</span>
      </div>

      {/* Edges (drawn first so they sit beneath cards) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
        {visibleEdges.map((e, i) => {
          const s = DEMO_LAYOUT_NODES[e.source];
          const t = DEMO_LAYOUT_NODES[e.target];
          const sx = (s.x + s.w) * scale;
          const sy = (s.y + s.h / 2) * scale;
          const tx = t.x * scale;
          const ty = (t.y + t.h / 2) * scale;
          const mx = (sx + tx) / 2;
          return (
            <motion.path
              key={`${e.source}-${e.target}`}
              d={`M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`}
              fill="none"
              stroke="#4A3AFF"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.6 }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: "easeOut" }}
            />
          );
        })}
      </svg>

      {/* Nodes */}
      {DEMO_LAYOUT_NODES.slice(0, appearedCount).map((n, idx) => (
        <motion.div
          key={n.label}
          initial={{ opacity: 0, scale: 0.92, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0 }}
          className="absolute rounded-xl border-2 border-white/80 bg-white/95 shadow-sm backdrop-blur flex flex-col overflow-hidden z-20"
          style={{
            left: n.x * scale,
            top: n.y * scale,
            width: n.w * scale,
            height: n.h * scale,
          }}
        >
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-cream-dark/40">
            <div className={`w-2 h-2 rounded-full ${n.type === "image" ? "bg-warm" : "bg-accent"}`} />
            <span className="text-[9px] font-mono text-ink-faint uppercase">{n.type}</span>
            <span className="text-[10px] font-medium text-ink ml-auto truncate">{n.label}</span>
          </div>
          <div className="flex-1 flex items-center justify-center px-3 py-2">
            {n.type === "image" ? (
              <div className="w-full h-full rounded-lg bg-gradient-to-br from-accent-soft via-cream to-warm-soft flex items-center justify-center relative overflow-hidden">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "linear", delay: idx * 0.3 }}
                />
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-ink-faint/40 relative" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="2" width="20" height="20" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
            ) : (
              <div className="w-full h-full rounded bg-cream/50 flex items-center justify-center">
                <div className="w-full space-y-1.5 px-1">
                  <div className="h-1.5 bg-ink-faint/15 rounded animate-pulse" />
                  <div className="h-1.5 bg-ink-faint/15 rounded w-3/4 animate-pulse" style={{ animationDelay: "0.1s" }} />
                  <div className="h-1.5 bg-ink-faint/15 rounded w-1/2 animate-pulse" style={{ animationDelay: "0.2s" }} />
                  <div className="h-1.5 bg-ink-faint/15 rounded w-2/3 animate-pulse" style={{ animationDelay: "0.3s" }} />
                </div>
              </div>
            )}
          </div>
        </motion.div>
      ))}

      {/* Agent cursor */}
      {showCursor && cursorTarget && (
        <motion.div
          className="absolute z-40 pointer-events-none"
          animate={{
            left: cursorTarget.x * scale,
            top: cursorTarget.y * scale,
          }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-accent drop-shadow" fill="currentColor">
              <path d="M5 3l14 9-6 1.5L11 21 5 3z" />
            </svg>
            <div className="absolute left-5 top-5 whitespace-nowrap bg-accent text-white text-[9px] font-mono px-1.5 py-0.5 rounded-md shadow">
              agent
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Ambient hero-side preview that loops the build animation
function AmbientCanvasLoop() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 14), 700);
    return () => clearInterval(id);
  }, []);

  const appearedCount = Math.min(6, Math.max(0, tick));
  const edgeCount = tick >= 6 ? Math.min(4, tick - 6) : 0;
  const targetIdx = Math.min(5, tick);
  const target = DEMO_LAYOUT_NODES[targetIdx];
  const cursorTarget = { x: target.x + target.w / 2, y: target.y + 20 };

  return (
    <div className="w-full aspect-[4/3] rounded-2xl border border-cream-dark bg-white overflow-hidden shadow-[0_2px_30px_-12px_rgba(74,58,255,0.18)]">
      <div className="w-full h-full origin-top-left" style={{ transform: "scale(0.55)", width: "182%", height: "182%" }}>
        <AgentCanvas
          appearedCount={appearedCount}
          edgeCount={edgeCount}
          showCursor
          cursorTarget={cursorTarget}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent log scripted timing — narrates the real MCP tool calls happening
// ─────────────────────────────────────────────────────────────────────────────
const AGENT_SCRIPT: Omit<AgentLogEntry, "id" | "ts">[] = [
  { phase: "enrich",     tool: "tinyfish.enrich",            message: "Reading public profile",                detail: "Fetching markdown + discovering related URLs" },
  { phase: "enrich",     tool: "tinyfish.enrich",            message: "Parsing surface signals",               detail: "Role · company · notable work · interests · tone" },
  { phase: "synthesise", tool: "claude.synthesise",          message: "Compressing into a profile object",     detail: "Structured JSON, tone classified" },
  { phase: "synthesise", tool: "claude.generateScript",      message: "Drafting outreach script",              detail: "Conversational, < 90 seconds, specific" },
  { phase: "canvas",     tool: "melius.createCanvas",        message: "Opening a fresh Melius canvas",         detail: "MCP session initialised" },
  { phase: "canvas",     tool: "melius.claimPresence",       message: "Claiming agent presence",               detail: "(0, 0) — 880 × 600 viewport" },
  { phase: "canvas",     tool: "melius.planLayout",          message: "Planning node layout",                  detail: "6 nodes · grid-snapped · room for edges" },
  { phase: "nodes",      tool: "create_custom_text_node",    message: "Placing Profile Summary",               detail: "node_type: custom_text" },
  { phase: "nodes",      tool: "create_custom_text_node",    message: "Placing Script",                        detail: "node_type: custom_text" },
  { phase: "nodes",      tool: "create_custom_text_node",    message: "Placing Visual Direction",              detail: "node_type: custom_text" },
  { phase: "nodes",      tool: "create_custom_text_node",    message: "Placing Outreach Objective",            detail: "node_type: custom_text" },
  { phase: "nodes",      tool: "create_image_node",          message: "Placing Video Background",              detail: "node_type: image · prompt seeded" },
  { phase: "nodes",      tool: "create_image_node",          message: "Placing Video Thumbnail",               detail: "node_type: image · prompt seeded" },
  { phase: "edges",      tool: "bulk_create_edges",          message: "Wiring Profile → Background",           detail: "edge_type: text" },
  { phase: "edges",      tool: "bulk_create_edges",          message: "Wiring Visual Direction → Background",  detail: "edge_type: text" },
  { phase: "edges",      tool: "bulk_create_edges",          message: "Wiring Profile → Thumbnail",            detail: "edge_type: text" },
  { phase: "edges",      tool: "bulk_create_edges",          message: "Wiring Visual Direction → Thumbnail",   detail: "edge_type: text" },
  { phase: "canvas",     tool: "create_group_node",          message: "Grouping nodes into one workspace",     detail: "Single draggable workspace" },
  { phase: "canvas",     tool: "add_comment",                message: "Leaving an audit comment",              detail: "Future humans will know an agent did this" },
  { phase: "generate",   tool: "start_run · seedance_image", message: "Kicking off background image",          detail: "Model: Seedance · poll for completion" },
  { phase: "generate",   tool: "start_run · seedance_image", message: "Kicking off thumbnail image",           detail: "Model: Seedance · poll for completion" },
  { phase: "generate",   tool: "release_presence",           message: "Handing the canvas back to you",        detail: "You can now edit any node" },
];

const PHASE_META: Record<AgentLogEntry["phase"], { label: string; color: string }> = {
  enrich:     { label: "Enrich",     color: "text-accent" },
  synthesise: { label: "Synthesise", color: "text-accent" },
  canvas:     { label: "Canvas",     color: "text-warm" },
  nodes:      { label: "Nodes",      color: "text-warm" },
  edges:      { label: "Edges",      color: "text-warm" },
  generate:   { label: "Generate",   color: "text-success" },
};

function StudioContent() {
  const [url, setUrl] = useState("");
  const [senderBrief, setSenderBrief] = useState("");
  const [stage, setStage] = useState<StudioStage>("input");
  const [buildResult, setBuildResult] = useState<StudioBuildResult | null>(null);
  const [error, setError] = useState("");
  const [iterating, setIterating] = useState<IteratingNode | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Building stage state — script-driven cinematic narration
  const [logIndex, setLogIndex] = useState(0);
  const [appearedCount, setAppearedCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [cursorTarget, setCursorTarget] = useState<{ x: number; y: number }>({ x: 50, y: 50 });

  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("demo") === "true") {
      setBuildResult(DEMO_BUILD_RESULT); // eslint-disable-line react-hooks/set-state-in-effect
      setStage("ready");
    }
  }, [searchParams]);

  // Drive the cinematic narration whenever we're in "building" stage.
  // The real network call runs in parallel; we wait for whichever finishes
  // last before flipping to "ready", so the user sees a coherent story.
  useEffect(() => {
    if (stage !== "building") return;
    setLogIndex(0); // eslint-disable-line react-hooks/set-state-in-effect
    setAppearedCount(0);
    setEdgeCount(0);

    let i = 0;
    const id = setInterval(() => {
      i += 1;
      if (i > AGENT_SCRIPT.length) {
        clearInterval(id);
        return;
      }
      setLogIndex(i);
      const entry = AGENT_SCRIPT[i - 1];
      if (entry.phase === "nodes") {
        setAppearedCount((c) => Math.min(6, c + 1));
        const targetIdx = Math.min(5, appearedCount);
        const t = DEMO_LAYOUT_NODES[targetIdx];
        setCursorTarget({ x: t.x + t.w / 2, y: t.y + 20 });
      } else if (entry.phase === "edges") {
        setEdgeCount((c) => Math.min(4, c + 1));
      }
    }, 650);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  async function handleBuild() {
    if (!url.trim()) return;
    setStage("building");
    setError("");

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

      // Wait for the narration to finish (so the user gets a complete story)
      // before revealing the canvas. Min total = ~14s narration + network.
      const minWaitMs = AGENT_SCRIPT.length * 650 + 400;
      await new Promise((r) => setTimeout(r, Math.max(0, minWaitMs - 800)));

      setBuildResult(result);
      setIframeLoaded(false);
      setStage("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("error");
    }
  }

  async function handleIterate(nodeId: string, newPrompt: string) {
    setIterating({ nodeId, label: "", prompt: newPrompt });

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
    if (!isReady || !canvasId || canvasId === DEMO_CANVAS_ID) return;

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

  const nodeStats = useMemo(() => {
    if (!buildResult) return { text: 0, image: 0, complete: 0, total: 0 };
    return {
      text: buildResult.nodes.filter((n) => n.type === "custom_text").length,
      image: buildResult.nodes.filter((n) => n.type === "image").length,
      complete: buildResult.nodes.filter((n) => n.status === "complete").length,
      total: buildResult.nodes.length,
    };
  }, [buildResult]);

  return (
    <>
      <Header stage={stage === "ready" ? "review" : stage === "building" ? "progress" : "input"} />

      <main className="flex-1 w-full">
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
              {/* Hero */}
              <section className="relative px-6 pt-24 pb-16">
                <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.05fr,1fr] gap-12 items-center">
                  <div className="space-y-7">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-soft border border-accent/15">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                      <span className="text-[10px] uppercase tracking-widest font-medium text-accent">
                        Built on Melius · agent-orchestrated
                      </span>
                    </div>
                    <h1 className="font-[family-name:var(--font-display)] text-5xl lg:text-6xl tracking-tight leading-[1.02]">
                      Brief an agent.
                      <br />
                      <span className="text-ink-muted">Watch it think</span>
                      <br />
                      on Melius.
                    </h1>
                    <p className="text-ink-muted text-base max-w-md leading-relaxed">
                      Drop in a profile URL. A nuncio agent reads the human, plans the canvas, places every node, wires the edges, and runs the visuals — live, on your Melius canvas. You step in only to taste-test.
                    </p>

                    <div className="space-y-3 max-w-md">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
                          Profile URL
                        </label>
                        <input
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="https://linkedin.com/in/…"
                          className="w-full rounded-xl border border-cream-dark bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                          onKeyDown={(e) => e.key === "Enter" && handleBuild()}
                        />
                        <div className="flex flex-wrap gap-2 mt-2">
                          {[
                            { label: "Sundar Pichai", url: "https://linkedin.com/in/sundarpichai" },
                            { label: "Vercel CEO",     url: "https://x.com/rauchg" },
                            { label: "Demo canvas",    url: "__demo__" },
                          ].map((example) => (
                            <button
                              key={example.label}
                              onClick={() => {
                                if (example.url === "__demo__") {
                                  setBuildResult(DEMO_BUILD_RESULT);
                                  setStage("ready");
                                } else {
                                  setUrl(example.url);
                                }
                              }}
                              className="text-[11px] text-ink-muted hover:text-accent transition-colors px-2.5 py-1 rounded-md border border-cream-dark/70 hover:border-accent/30 bg-white/60"
                            >
                              {example.url === "__demo__" ? "▶ " : "Try "}{example.label}
                            </button>
                          ))}
                        </div>
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
                          className="w-full rounded-xl border border-cream-dark bg-white px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                        />
                      </div>

                      <button
                        onClick={handleBuild}
                        disabled={!url.trim()}
                        className="btn-press w-full rounded-xl bg-ink text-cream py-3.5 text-sm font-medium disabled:opacity-40 hover:bg-ink-light transition-colors flex items-center justify-center gap-2"
                      >
                        Brief the agent
                        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 8h10M9 4l4 4-4 4" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Ambient preview */}
                  <div className="hidden lg:block">
                    <AmbientCanvasLoop />
                    <p className="text-[11px] text-ink-faint text-center mt-3 font-mono">
                      ↑ live preview · what the agent does to a Melius canvas
                    </p>
                  </div>
                </div>
              </section>

              {/* How it works — 4 steps */}
              <section className="px-6 pb-24 max-w-6xl mx-auto">
                <div className="text-center mb-10">
                  <p className="text-[10px] uppercase tracking-widest font-medium text-ink-faint">
                    How the agent works
                  </p>
                  <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-tight mt-2">
                    Four moves. Six nodes. One canvas you can edit.
                  </h2>
                </div>
                <div className="grid md:grid-cols-4 gap-4">
                  {[
                    {
                      kicker: "01",
                      title: "Reads the human",
                      body: "Pulls public signals — role, tone, recent work — through a structured enrichment pass.",
                      tool: "tinyfish · claude",
                    },
                    {
                      kicker: "02",
                      title: "Plans the canvas",
                      body: "Decides what nodes the campaign needs, how they should connect, and where they live in space.",
                      tool: "melius.planLayout",
                    },
                    {
                      kicker: "03",
                      title: "Builds it on Melius",
                      body: "Calls the Melius MCP to create text + image nodes, then wires edges so prompts inherit context.",
                      tool: "create_*_node · bulk_create_edges",
                    },
                    {
                      kicker: "04",
                      title: "Hands it to you",
                      body: "Kicks off the image runs, leaves an audit comment, releases presence. You iterate from there.",
                      tool: "start_run · release_presence",
                    },
                  ].map((step) => (
                    <div
                      key={step.kicker}
                      className="rounded-2xl border border-cream-dark bg-white p-5 space-y-2.5 hover:border-accent/30 hover:shadow-[0_2px_30px_-12px_rgba(74,58,255,0.18)] transition-all"
                    >
                      <span className="text-[10px] font-mono text-accent">{step.kicker}</span>
                      <h3 className="font-medium text-ink">{step.title}</h3>
                      <p className="text-xs text-ink-muted leading-relaxed">{step.body}</p>
                      <p className="text-[10px] font-mono text-ink-faint pt-1 truncate">{step.tool}</p>
                    </div>
                  ))}
                </div>
              </section>
            </motion.div>
          )}

          {/* ─── BUILDING ─────────────────────────────────────────────── */}
          {stage === "building" && (
            <motion.div
              key="building"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-6 pt-24 pb-16 max-w-7xl mx-auto"
            >
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-soft border border-accent/15 mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  <span className="text-[10px] uppercase tracking-widest font-medium text-accent">
                    Agent working live on Melius
                  </span>
                </div>
                <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
                  Building your canvas
                </h1>
                <p className="text-sm text-ink-muted mt-2">
                  Don&apos;t close this — watch the agent narrate every MCP call.
                </p>
              </div>

              <div className="grid lg:grid-cols-[1.4fr,1fr] gap-6">
                {/* Canvas */}
                <div className="rounded-2xl border border-cream-dark bg-white overflow-hidden shadow-[0_2px_40px_-16px_rgba(74,58,255,0.25)]">
                  <div className="aspect-[4/3] relative">
                    <div className="w-full h-full origin-top-left" style={{ transform: "scale(0.65)", width: "154%", height: "154%" }}>
                      <AgentCanvas
                        appearedCount={appearedCount}
                        edgeCount={edgeCount}
                        showCursor
                        cursorTarget={cursorTarget}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 px-4 py-2.5 border-t border-cream-dark text-[11px] font-mono text-ink-faint">
                    <span><span className="text-ink">{appearedCount}</span>/6 nodes</span>
                    <span><span className="text-ink">{edgeCount}</span>/4 edges</span>
                    <span className="ml-auto">{Math.min(100, Math.round((logIndex / AGENT_SCRIPT.length) * 100))}%</span>
                  </div>
                </div>

                {/* Agent log */}
                <div className="rounded-2xl border border-cream-dark bg-ink text-cream overflow-hidden flex flex-col">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-error/70" />
                      <span className="w-2.5 h-2.5 rounded-full bg-warm/70" />
                      <span className="w-2.5 h-2.5 rounded-full bg-success/70" />
                    </div>
                    <span className="text-[10px] font-mono text-cream/50 ml-2">agent.log · mcp tool calls</span>
                  </div>
                  <div className="flex-1 px-4 py-3 space-y-1.5 overflow-y-auto max-h-[500px] font-mono text-[11px]">
                    {AGENT_SCRIPT.slice(0, logIndex).map((entry, i) => {
                      const meta = PHASE_META[entry.phase];
                      const isLatest = i === logIndex - 1;
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.25 }}
                          className="space-y-0.5"
                        >
                          <div className="flex items-baseline gap-2">
                            <span className={`text-[9px] uppercase tracking-wider ${meta.color} w-16 shrink-0`}>
                              {meta.label}
                            </span>
                            <span className="text-cream/50 text-[10px]">→</span>
                            <span className="text-cream/90">
                              {entry.message}
                              {isLatest && <span className="ml-1 animate-pulse">▍</span>}
                            </span>
                          </div>
                          {entry.tool && (
                            <div className="flex items-baseline gap-2 pl-[72px]">
                              <span className="text-cream/30">$</span>
                              <span className="text-accent-soft/80 truncate">{entry.tool}</span>
                            </div>
                          )}
                          {entry.detail && (
                            <div className="pl-[72px] text-cream/40 text-[10px]">
                              {entry.detail}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── ERROR ────────────────────────────────────────────────── */}
          {stage === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md mx-auto pt-32 px-6 text-center space-y-4"
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

          {/* ─── READY ────────────────────────────────────────────────── */}
          {stage === "ready" && buildResult && (
            <motion.div
              key="ready"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-6 pt-24 pb-12 max-w-7xl mx-auto space-y-6"
            >
              {/* Recap */}
              <div className="rounded-2xl border border-cream-dark bg-gradient-to-br from-white via-white to-accent-soft/30 p-5 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-success-soft border border-success/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  <span className="text-[10px] uppercase tracking-widest font-medium text-success">
                    Agent done
                  </span>
                </div>
                <p className="text-sm text-ink">
                  Built <span className="font-medium">{nodeStats.total} nodes</span> ({nodeStats.text} text · {nodeStats.image} image), wired 4 edges, kicked off 2 image runs.
                  {canvasId === DEMO_CANVAS_ID && (
                    <span className="text-accent ml-1">· demo</span>
                  )}
                </p>
                <div className="ml-auto flex items-center gap-2">
                  {canvasId !== DEMO_CANVAS_ID && (
                    <a
                      href={buildResult.canvasUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-cream-dark px-3 py-1.5 text-xs font-medium text-ink hover:bg-cream-dark/50 transition-colors"
                    >
                      Open in Melius
                      <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M6 2L2 6v8h12V2H6zM2 6h4V2" />
                      </svg>
                    </a>
                  )}
                  <button
                    onClick={() => { setStage("input"); setBuildResult(null); setUrl(""); setSenderBrief(""); }}
                    className="btn-press rounded-lg bg-ink text-cream px-3 py-1.5 text-xs font-medium hover:bg-ink-light transition-colors"
                  >
                    Brief another →
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1.6fr,1fr] gap-6">
                {/* Canvas hero */}
                <div className="rounded-2xl border border-cream-dark bg-white overflow-hidden relative min-h-[480px] shadow-[0_2px_40px_-16px_rgba(74,58,255,0.25)]">
                  {!iframeLoaded && canvasId !== DEMO_CANVAS_ID && (
                    <div className="absolute inset-0 bg-cream/80 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-2xl">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
                        <p className="text-xs text-ink-faint">Loading canvas…</p>
                      </div>
                    </div>
                  )}
                  {canvasId === DEMO_CANVAS_ID ? (
                    <div className="w-full aspect-[4/3]">
                      <AgentCanvas appearedCount={6} edgeCount={4} />
                    </div>
                  ) : (
                    <iframe
                      src={buildResult.embedUrl}
                      className="w-full aspect-[4/3]"
                      allow="clipboard-read; clipboard-write"
                      title="Melius Canvas"
                      onLoad={() => setIframeLoaded(true)}
                    />
                  )}
                </div>

                {/* Inspector */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[10px] font-medium text-ink-faint uppercase tracking-widest">
                      Node inspector
                    </h2>
                    <span className="text-[10px] font-mono text-ink-faint">
                      {nodeStats.complete}/{nodeStats.total} ready
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                    {buildResult.nodes.map((node) => (
                      <NodeCard
                        key={node.id}
                        node={node}
                        isIterating={iterating?.nodeId === node.id}
                        onRegenerate={(prompt) => handleIterate(node.id, prompt)}
                      />
                    ))}
                  </div>

                  <p className="text-[10px] text-ink-faint leading-relaxed pt-1">
                    Tap <span className="text-accent">Edit</span> on any image node to rewrite the prompt and re-run the model — the change propagates back to Melius.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}

export default function StudioPage() {
  return (
    <Suspense>
      <StudioContent />
    </Suspense>
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
    <div className="rounded-xl border border-cream-dark bg-white p-3 space-y-2 hover:border-accent/20 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs shrink-0">{statusIcon(node.status)}</span>
          <span className={`text-[10px] font-mono uppercase ${typeColor}`}>{node.type}</span>
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
              Updates prompt & re-runs on Melius
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
