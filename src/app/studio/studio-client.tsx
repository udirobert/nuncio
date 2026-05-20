"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { FormEvent, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import type { StudioBuildResult, StudioNode } from "@/lib/creative/melius-provider";
import type { VideoCustomization, HeyGenAvatar, HeyGenVoice } from "@/lib/heygen";
import { VideoCustomization as VideoCustomizationComponent } from "@/components/video-customization";

type StudioStage = "input" | "building" | "ready" | "error";
type ArchetypeSelection = "auto" | "mirror" | "origin" | "future_cast" | "inside_joke" | "day_in_the_life";
type CaptureIntent = "share" | "download" | "render";

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
    label: "Download canvas",
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
    label: "Share campaign",
    chipClass: "bg-success-soft border-success/20 text-success",
    iconClass: "bg-success text-white",
  },
};

const ARCHETYPE_OPTIONS: { id: ArchetypeSelection; label: string }[] = [
  { id: "auto", label: "Let agent pick" },
  { id: "mirror", label: "Mirror" },
  { id: "origin", label: "Origin" },
  { id: "future_cast", label: "Future-cast" },
  { id: "inside_joke", label: "Inside joke" },
  { id: "day_in_the_life", label: "Day-in-life" },
];

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
  { id: "n7", label: "Hook Concept", type: "custom_text", status: "complete", prompt: "Mirror hook for Sundar Pichai: reimagine Google's AI infrastructure as a quiet cinematic product surface coming alive." },
  { id: "n8", label: "Hook Cinematic", type: "video", status: "complete", prompt: "Generate a 3-second cinematic outreach hook. Mirror archetype. No readable text. No logos. 16:9.", outputUrl: "/onee-yekeh-demo.mp4" },
];

const DEMO_BUILD_RESULT: StudioBuildResult = {
  projectId: "demo-project-001",
  canvasId: DEMO_CANVAS_ID,
  canvasUrl: "https://app.melius.com/canvas/demo",
  nodes: DEMO_NODES,
  hook: {
    archetype: "Mirror",
    reasoning: "The recipient has a visible company and product surface, so mirroring the work creates the most specific opening shot.",
    tier: "trial",
    remainingFree: 0,
    canRegenerate: false,
    watermark: true,
    status: "complete",
    format: "16:9 · 45s · landscape · captions off",
    formatReasoning: "The demo target reads as an executive/product audience, so a polished landscape format keeps the walkthrough presentation-ready.",
    outputUrl: "/onee-yekeh-demo.mp4",
  },
};

const DEMO_LAYOUT_NODES: {
  x: number; y: number; w: number; h: number;
  label: string;
  type: "custom_text" | "image" | "video";
  edgesIn?: number[];
}[] = [
  { x: 20,  y: 20,  w: 360, h: 140, label: "Profile Summary",    type: "custom_text" },
  { x: 20,  y: 175, w: 360, h: 200, label: "Script",             type: "custom_text" },
  { x: 20,  y: 390, w: 360, h: 140, label: "Visual Direction",   type: "custom_text" },
  { x: 20,  y: 545, w: 360, h: 100, label: "Outreach Objective", type: "custom_text" },
  { x: 420, y: 20,  w: 360, h: 230, label: "Video Background",   type: "image", edgesIn: [0, 2] },
  { x: 420, y: 265, w: 360, h: 230, label: "Video Thumbnail",    type: "image", edgesIn: [0, 2] },
  { x: 820, y: 20,  w: 360, h: 150, label: "Hook Concept",       type: "custom_text" },
  { x: 820, y: 190, w: 360, h: 230, label: "Hook Cinematic",     type: "video", edgesIn: [2, 6] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Animated mini-canvas — visual recap of what the agent built
// ─────────────────────────────────────────────────────────────────────────────
function AgentCanvas({
  appearedCount,
  edgeCount,
  scale = 1,
  showCursor = false,
  cursorTarget,
}: {
  appearedCount: number;
  edgeCount: number;
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
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-25">
        <defs>
          <pattern id="agent-grid" width={20 * scale} height={20 * scale} patternUnits="userSpaceOnUse">
            <path d={`M ${20 * scale} 0 L 0 0 0 ${20 * scale}`} fill="none" stroke="#8b7f6f" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#agent-grid)" />
      </svg>

      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur rounded-lg px-2.5 py-1 shadow-sm border border-cream-dark z-30">
        <span className="text-[10px] font-mono text-ink-faint">melius canvas</span>
      </div>

      {/* Edges */}
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
            <div className={`w-2 h-2 rounded-full ${n.type === "image" ? "bg-warm" : n.type === "video" ? "bg-success" : "bg-accent"}`} />
            <span className="text-[9px] font-mono text-ink-faint uppercase">{n.type}</span>
            <span className="text-[10px] font-medium text-ink ml-auto truncate">{n.label}</span>
          </div>
          <div className="flex-1 flex items-center justify-center px-3 py-2">
            {n.type === "image" || n.type === "video" ? (
              <div className={`w-full h-full rounded-lg flex items-center justify-center relative overflow-hidden ${
                n.type === "video"
                  ? "bg-gradient-to-br from-ink via-accent to-warm"
                  : "bg-gradient-to-br from-accent-soft via-cream to-warm-soft"
              }`}>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "linear", delay: idx * 0.3 }}
                />
                {n.type === "video" ? (
                  <svg viewBox="0 0 24 24" className="w-7 h-7 text-white/70 relative" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-6 h-6 text-ink-faint/40 relative" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="2" width="20" height="20" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                )}
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

function AmbientCanvasLoop() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 18), 700);
    return () => clearInterval(id);
  }, []);

  const appearedCount = Math.min(8, Math.max(0, tick));
  const edgeCount = tick >= 8 ? Math.min(6, tick - 8) : 0;
  const targetIdx = Math.min(7, tick);
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
// Agent log script
// ─────────────────────────────────────────────────────────────────────────────
const AGENT_SCRIPT: Omit<AgentLogEntry, "id" | "ts">[] = [
  { phase: "enrich",     tool: "tinyfish.enrich",            message: "Reading public profile",                detail: "Fetching markdown + discovering related URLs" },
  { phase: "enrich",     tool: "tinyfish.enrich",            message: "Parsing surface signals",               detail: "Role · company · notable work · interests · tone" },
  { phase: "synthesise", tool: "claude.synthesise",          message: "Compressing into a profile object",     detail: "Structured JSON, tone classified" },
  { phase: "synthesise", tool: "claude.generateScript",      message: "Drafting outreach script",              detail: "Conversational, < 90 seconds, specific" },
  { phase: "canvas",     tool: "melius.createCanvas",        message: "Opening a fresh Melius canvas",         detail: "MCP session initialised" },
  { phase: "canvas",     tool: "melius.claimPresence",       message: "Claiming agent presence",               detail: "(0, 0) — 880 × 600 viewport" },
  { phase: "canvas",     tool: "melius.planLayout",          message: "Planning node layout",                  detail: "8 nodes · dynamic positions" },
  { phase: "nodes",      tool: "create_custom_text_node",    message: "Placing Profile Summary",               detail: "node_type: custom_text" },
  { phase: "nodes",      tool: "create_custom_text_node",    message: "Placing Script",                        detail: "node_type: custom_text" },
  { phase: "nodes",      tool: "create_custom_text_node",    message: "Placing Visual Direction",              detail: "node_type: custom_text" },
  { phase: "nodes",      tool: "create_custom_text_node",    message: "Placing Outreach Objective",            detail: "node_type: custom_text" },
  { phase: "nodes",      tool: "create_image_node",          message: "Placing Video Background",              detail: "node_type: image · prompt seeded" },
  { phase: "nodes",      tool: "create_image_node",          message: "Placing Video Thumbnail",               detail: "node_type: image · prompt seeded" },
  { phase: "nodes",      tool: "create_custom_text_node",    message: "Placing Hook Concept",                  detail: "node_type: custom_text · archetype reasoning" },
  { phase: "nodes",      tool: "create_video_node",          message: "Placing Hook Cinematic",                detail: "node_type: video · Melius generation" },
  { phase: "edges",      tool: "bulk_create_edges",          message: "Wiring node connections",               detail: "Context flows between nodes" },
  { phase: "canvas",     tool: "create_group_node",          message: "Grouping into workspace",               detail: "Single draggable workspace" },
  { phase: "canvas",     tool: "add_comment",                message: "Leaving an audit comment",              detail: "Future humans will know an agent did this" },
  { phase: "generate",   tool: "run_start",                  message: "Starting image generation",             detail: "Background + Thumbnail via Melius" },
  { phase: "generate",   tool: "run_start",                  message: "Starting hook video generation",        detail: "Via Melius video node" },
  { phase: "generate",   tool: "release_presence",           message: "Handing the canvas to you",             detail: "Open in Melius to iterate" },
];

const PHASE_META: Record<AgentLogEntry["phase"], { label: string; color: string }> = {
  enrich:     { label: "Enrich",     color: "text-accent" },
  synthesise: { label: "Synthesise", color: "text-accent" },
  canvas:     { label: "Canvas",     color: "text-warm" },
  nodes:      { label: "Nodes",      color: "text-warm" },
  edges:      { label: "Edges",      color: "text-warm" },
  generate:   { label: "Generate",   color: "text-success" },
};

interface StudioClientProps {
  initialAvatars?: HeyGenAvatar[];
  initialVoices?: HeyGenVoice[];
}

function StudioClient({ initialAvatars, initialVoices }: StudioClientProps) {
  const [url, setUrl] = useState("");
  const [senderBrief, setSenderBrief] = useState("");
  const [stage, setStage] = useState<StudioStage>("input");
  const [buildResult, setBuildResult] = useState<StudioBuildResult | null>(null);
  const [error, setError] = useState("");
  const [archetype, setArchetype] = useState<ArchetypeSelection>("auto");
  const [capturedEmail, setCapturedEmail] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [captureIntent, setCaptureIntent] = useState<CaptureIntent | null>(null);
  const [captureEmail, setCaptureEmail] = useState("");
  const [captureHoneypot, setCaptureHoneypot] = useState("");
  const [captureError, setCaptureError] = useState("");
  const [captureLoading, setCaptureLoading] = useState(false);
  const [showHookReasoning, setShowHookReasoning] = useState(false);
  const [videoRendering, setVideoRendering] = useState<"idle" | "rendering" | "done" | "failed">("idle");
  const [videoRenderResult, setVideoRenderResult] = useState<{ videoUrl: string; videoId: string } | null>(null);
  const [videoComposed, setVideoComposed] = useState(false);
  const [videoCustomization, setVideoCustomization] = useState<VideoCustomization | undefined>();
  const [showCustomization, setShowCustomization] = useState(false);

  // Melius connection
  const [meliusKey, setMeliusKey] = useState<string>("");
  const [meliusKeyInput, setMeliusKeyInput] = useState("");
  const [showMeliusConnect, setShowMeliusConnect] = useState(false);

  // Building stage state
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
    try {
      const stored = sessionStorage.getItem("nuncio_studio_bridge");
      if (stored) {
        const data = JSON.parse(stored);
        if (data.url) setUrl(data.url);
        if (data.brief) setSenderBrief(data.brief);
        sessionStorage.removeItem("nuncio_studio_bridge");
      }
    } catch {
      // ignore parse errors
    }
    const savedKey = localStorage.getItem("nuncio_melius_key");
    if (savedKey) setMeliusKey(savedKey);
  }, [searchParams]);

  function connectMelius() {
    const key = meliusKeyInput.trim();
    if (!key.startsWith("mk_")) return;
    localStorage.setItem("nuncio_melius_key", key);
    setMeliusKey(key);
    setMeliusKeyInput("");
    setShowMeliusConnect(false);
  }

  function disconnectMelius() {
    localStorage.removeItem("nuncio_melius_key");
    setMeliusKey("");
  }

  async function handleBuild() {
    if (!url.trim()) return;
    setLogIndex(0);
    setAppearedCount(0);
    setEdgeCount(0);
    setStage("building");
    setError("");
    setShowHookReasoning(false);

    try {
      const res = await fetch("/api/studio/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          senderBrief: senderBrief.trim() || undefined,
          email: capturedEmail || undefined,
          archetype: archetype === "auto" ? undefined : archetype,
          meliusApiKey: meliusKey || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Build failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Failed to read stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let currentLogIndex = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.error) throw new Error(data.error);

            if (data.phase) {
              currentLogIndex++;
              setLogIndex(currentLogIndex);

              if (data.phase === "nodes") {
                setAppearedCount((c) => Math.min(8, c + 1));
                const targetIdx = Math.min(7, appearedCount);
                const t = DEMO_LAYOUT_NODES[targetIdx];
                setCursorTarget({ x: t.x + t.w / 2, y: t.y + 20 });
              } else if (data.phase === "edges") {
                setEdgeCount((c) => Math.min(6, c + 1));
              }
            }

            if (data.canvas) {
              setBuildResult((prev) => ({
                ...prev,
                ...data.canvas,
                nodes: prev?.nodes || [],
              } as StudioBuildResult));
            }

            if (data.node) {
              setBuildResult((prev) => {
                if (!prev) return prev;
                const exists = prev.nodes.find(n => n.id === data.node.id);
                if (exists) {
                  return { ...prev, nodes: prev.nodes.map(n => n.id === data.node.id ? { ...n, ...data.node } : n) };
                }
                return { ...prev, nodes: [...prev.nodes, data.node] };
              });
            }

            if (data.type === "done") {
              setBuildResult(data.result);
              setStage("ready");
              return;
            }
          } catch (e) {
            console.error("Stream parse error:", e, line);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("error");
    }
  }

  function openCapture(intent: CaptureIntent) {
    setCaptureIntent(intent);
    setCaptureError("");
    setCaptureEmail(capturedEmail);
  }

  async function handleEmailCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!buildResult) return;

    setCaptureLoading(true);
    setCaptureError("");
    try {
      const res = await fetch("/api/studio/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: captureEmail,
          honeypot: captureHoneypot,
          buildResult: {
            projectId: buildResult.projectId,
            canvasId: buildResult.canvasId,
            canvasUrl: buildResult.canvasUrl,
            hook: buildResult.hook,
          },
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
      }
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCaptureLoading(false);
    }
  }

  async function handleShareClick() {
    if (!buildResult) return;
    if (!capturedEmail || !shareUrl) {
      openCapture("share");
      return;
    }
    await copyShareUrl(shareUrl);
  }

  async function handleDownloadClick() {
    if (!buildResult) return;
    if (!capturedEmail) {
      openCapture("download");
      return;
    }
    try {
      const res = await fetch("/api/studio/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasId: buildResult.canvasId }),
      });
      const data = await res.json();
      if (res.ok && data.downloadUrl) {
        window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
        return;
      }
    } catch {
      // fall through
    }
    openDownloadTarget();
  }

  async function handleRenderVideo(email = capturedEmail) {
    if (!buildResult || videoRendering === "rendering") return;
    if (!email) {
      openCapture("render");
      return;
    }

    if (buildResult.canvasId === DEMO_CANVAS_ID) {
      setVideoRendering("rendering");
      setCaptureIntent(null);
      await new Promise((r) => setTimeout(r, 3000));
      setVideoRenderResult({ videoUrl: "/onee-yekeh-demo.mp4", videoId: "demo-video" });
      setVideoComposed(true);
      setVideoRendering("done");
      return;
    }

    const scriptNode = buildResult.nodes.find((n) => n.label === "Script" && n.type === "custom_text");
    if (!scriptNode?.prompt) {
      setVideoRendering("failed");
      setCaptureError("No script found in this build — try building again.");
      return;
    }

    const profileNode = buildResult.nodes.find((n) => n.label === "Profile Summary" && n.type === "custom_text");
    const recipientName = profileNode?.prompt?.split("—")[0]?.trim() || undefined;

    const assetUrls = buildResult.nodes
      .filter((n) => n.outputUrl && (n.type === "image" || n.type === "video"))
      .map((n) => n.outputUrl!)
      .filter(Boolean);

    setVideoRendering("rendering");
    setCaptureIntent(null);

    try {
      const res = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: scriptNode.prompt,
          assetUrls,
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

      const hookUrl = buildResult.hook?.outputUrl;
      let finalUrl = videoUrl;
      if (hookUrl && hookUrl !== videoUrl) {
        try {
          const composeRes = await fetch("/api/compose", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hookUrl, bodyUrl: videoUrl }),
          });
          const composeData = await composeRes.json();
          if (composeData.composedUrl) {
            finalUrl = composeData.composedUrl;
            setVideoComposed(true);
          }
        } catch {
          console.warn("[studio] Hook composition failed, showing body-only");
        }
      }
      setVideoRenderResult({ videoUrl: finalUrl, videoId });
      setVideoRendering("done");
    } catch (err) {
      setVideoRendering("failed");
      setCaptureError(err instanceof Error ? err.message : "Video render failed");
    }
  }

  async function copyShareUrl(path: string) {
    const absolute = new URL(path, window.location.origin).toString();
    await navigator.clipboard?.writeText(absolute);
  }

  function openDownloadTarget() {
    const hookUrl = buildResult?.hook?.outputUrl;
    if (hookUrl) {
      window.open(hookUrl, "_blank", "noopener,noreferrer");
    }
  }

  // Poll Melius for node generation status
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const isReady = stage === "ready";
  const canvasId = buildResult?.canvasId;

  useEffect(() => {
    if (!isReady || !canvasId || canvasId === DEMO_CANVAS_ID) return;

    pollRef.current = setInterval(async () => {
      try {
        const pollUrl = meliusKey
          ? `/api/studio/canvas/${canvasId}?key=${encodeURIComponent(meliusKey)}`
          : `/api/studio/canvas/${canvasId}`;
        const res = await fetch(pollUrl);
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
  }, [isReady, canvasId, meliusKey]);

  const nodeStats = useMemo(() => {
    if (!buildResult) return { text: 0, image: 0, video: 0, complete: 0, total: 0 };
    return {
      text: buildResult.nodes.filter((n) => n.type === "custom_text").length,
      image: buildResult.nodes.filter((n) => n.type === "image").length,
      video: buildResult.nodes.filter((n) => n.type === "video").length,
      complete: buildResult.nodes.filter((n) => n.status === "complete").length,
      total: buildResult.nodes.length,
    };
  }, [buildResult]);

  const handleCustomize = useCallback((c: VideoCustomization) => {
    setVideoCustomization(c);
  }, []);

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
                      <span className="text-ink-muted">Get personalised creative.</span>
                    </h1>
                    <p className="text-ink-muted text-base max-w-md leading-relaxed">
                      Drop in a profile URL. A nuncio agent reads the human, generates a personalised outreach script, cinematic images, and a hook video — all powered by Melius under the hood.
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
                            { label: "Vercel CEO", url: "https://x.com/rauchg" },
                            { label: "Demo canvas", url: "__demo__" },
                          ].map((example) => (
                            <button
                              key={example.label}
                              onClick={() => {
                                if (example.url === "__demo__") {
                                  setBuildResult(DEMO_BUILD_RESULT);
                                  setShowHookReasoning(false);
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

                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
                          Hook archetype
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {ARCHETYPE_OPTIONS.map((option) => (
                            <button
                              key={option.id}
                              onClick={() => setArchetype(option.id)}
                              className={`rounded-md border px-2.5 py-1 text-[11px] transition-colors ${
                                archetype === option.id
                                  ? "border-accent bg-accent-soft text-accent"
                                  : "border-cream-dark/70 bg-white/60 text-ink-muted hover:border-accent/30 hover:text-accent"
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Melius connection */}
                      <div className="pt-1">
                        {meliusKey ? (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-success/20 bg-success-soft">
                            <span className="w-1.5 h-1.5 rounded-full bg-success" />
                            <span className="text-[11px] font-medium text-success">Melius connected</span>
                            <span className="text-[10px] text-ink-faint ml-1 font-mono">{meliusKey.slice(0, 10)}…</span>
                            <button
                              onClick={disconnectMelius}
                              className="ml-auto text-[10px] text-ink-faint hover:text-error transition-colors"
                            >
                              Disconnect
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => setShowMeliusConnect(!showMeliusConnect)}
                              className="text-[11px] text-ink-faint hover:text-accent transition-colors flex items-center gap-1.5"
                            >
                              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M6 3h4v2H6zM3 7h10v6H3z" />
                                <path d="M8 5v2M5 10h6" />
                              </svg>
                              Connect your Melius account
                              <span className="text-[9px] text-ink-faint/60 ml-1">optional</span>
                            </button>
                            {showMeliusConnect && (
                              <div className="mt-2 p-3 rounded-lg border border-cream-dark bg-cream/30 space-y-2">
                                <p className="text-[11px] text-ink-muted leading-relaxed">
                                  Paste your Melius API key to build canvases in your own workspace. Generate a key in Melius → Team Settings → API keys.
                                </p>
                                <p className="text-[10px] text-ink-faint leading-relaxed">
                                  Your key is stored in this browser only and sent over HTTPS to make Melius calls — never persisted on our servers.
                                </p>
                                <div className="flex gap-2">
                                  <input
                                    value={meliusKeyInput}
                                    onChange={(e) => setMeliusKeyInput(e.target.value)}
                                    placeholder="mk_live_…"
                                    className="flex-1 rounded-lg border border-cream-dark bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                                  />
                                  <button
                                    onClick={connectMelius}
                                    disabled={!meliusKeyInput.trim().startsWith("mk_")}
                                    className="rounded-lg bg-accent text-white px-3 py-2 text-xs font-medium disabled:opacity-40 hover:bg-accent/90 transition-colors"
                                  >
                                    Connect
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
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

                  <div className="hidden lg:block">
                    <AmbientCanvasLoop />
                    <p className="text-[11px] text-ink-faint text-center mt-3 font-mono">
                      ↑ live preview · what the agent builds on Melius
                    </p>
                  </div>
                </div>
              </section>

              <section className="px-6 pb-24 max-w-6xl mx-auto">
                <div className="text-center mb-10">
                  <p className="text-[10px] uppercase tracking-widest font-medium text-ink-faint">
                    How the agent works
                  </p>
                  <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-tight mt-2">
                    Four moves. Eight nodes. Creative you can use.
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
                      body: "Decides what nodes the campaign needs, how they connect, and asks Melius to lay them out.",
                      tool: "melius.planLayout",
                    },
                    {
                      kicker: "03",
                      title: "Builds on Melius",
                      body: "Creates text, image, and video nodes. Wires edges so prompts inherit upstream context.",
                      tool: "bulk_create_nodes · bulk_create_edges",
                    },
                    {
                      kicker: "04",
                      title: "Delivers creative",
                      body: "Starts generation runs and delivers your images, hook video, and script — ready to render or share.",
                      tool: "run_start · bulk_run_download",
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
                    Agent working on Melius
                  </span>
                </div>
                <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
                  Building your canvas
                </h1>
                <p className="text-sm text-ink-muted mt-2">
                  The agent is placing nodes and wiring your creative on Melius.
                </p>
              </div>

              {logIndex <= 4 ? (
                <div className="max-w-2xl mx-auto w-full mt-4">
                  <AgentLogPanel logIndex={logIndex} />
                </div>
              ) : (
                <div className="grid lg:grid-cols-[1.4fr,1fr] gap-6">
                  <div className="rounded-2xl border border-cream-dark bg-white overflow-hidden shadow-[0_2px_40px_-16px_rgba(74,58,255,0.25)]">
                    <div className="aspect-[4/3] relative">
                      <div className="w-full h-full origin-top-left" style={{ transform: "scale(0.85)", width: "118%", height: "118%" }}>
                        <AgentCanvas
                          appearedCount={appearedCount}
                          edgeCount={edgeCount}
                          showCursor
                          cursorTarget={cursorTarget}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 px-4 py-2.5 border-t border-cream-dark text-[11px] font-mono text-ink-faint">
                      <span><span className="text-ink">{appearedCount}</span>/8 nodes</span>
                      <span><span className="text-ink">{edgeCount}</span>/6 edges</span>
                      <span className="ml-auto">{Math.min(100, Math.round((logIndex / AGENT_SCRIPT.length) * 100))}%</span>
                    </div>
                  </div>

                  <AgentLogPanel logIndex={logIndex} />
                </div>
              )}
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
                  <p className="text-sm text-ink">
                    {nodeStats.complete === nodeStats.total ? (
                      <>All <span className="font-medium">{nodeStats.total} assets</span> generated.</>
                    ) : (
                      <><span className="font-medium">{nodeStats.complete}/{nodeStats.total}</span> assets generated — images and video are still rendering…</>
                    )}
                  </p>
                </div>

                {buildResult.hook && (
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium">
                    <span className="rounded-full border border-accent/20 bg-white px-2.5 py-1 text-accent">
                      {buildResult.hook.archetype} · {buildResult.hook.format}
                    </span>
                    {buildResult.hook.status === "generating" && (
                      <span className="rounded-full border border-warm/20 bg-warm-soft px-2.5 py-1 text-warm animate-pulse">
                        generating…
                      </span>
                    )}
                    <button
                      onClick={() => setShowHookReasoning((v) => !v)}
                      className="rounded-full border border-accent/20 bg-white px-2.5 py-1 text-accent hover:bg-accent-soft transition-colors"
                    >
                      why this hook?
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 border-t border-cream-dark/50 pt-4">
                  <button
                    onClick={() => {
                      if (!capturedEmail) { openCapture("render"); } else { handleRenderVideo(); }
                    }}
                    disabled={videoRendering === "rendering"}
                    className="btn-press inline-flex items-center gap-2 rounded-xl bg-ink text-cream px-5 py-3 text-sm font-medium hover:bg-ink-light transition-colors shadow-sm disabled:opacity-40"
                  >
                    {videoRendering === "rendering" ? "Rendering…" : videoRendering === "done" ? "Video ready" : "Render HeyGen video"}
                  </button>

                  <button
                    onClick={handleDownloadClick}
                    className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-cream-dark px-4 py-3 text-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors"
                  >
                    Export ZIP
                  </button>

                  <button
                    onClick={handleShareClick}
                    className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-cream-dark px-3 py-2.5 text-xs font-medium text-ink-muted hover:bg-cream-dark/50 transition-colors"
                  >
                    Share
                  </button>

                  {buildResult.userOwned && buildResult.canvasUrl && (
                    <a
                      href={buildResult.canvasUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-accent/20 bg-accent-soft px-3 py-2.5 text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
                    >
                      Open in Melius
                      <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M6 3h7v7M13 3L6 10" />
                      </svg>
                    </a>
                  )}

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
                    className="btn-press rounded-lg border border-cream-dark px-3 py-2.5 text-xs font-medium text-ink-muted hover:text-ink hover:bg-cream-dark/50 transition-colors"
                  >
                    Brief another →
                  </button>
                </div>

                {/* Video customization */}
                <div className="border-t border-cream-dark/50 pt-3">
                  <button
                    onClick={() => setShowCustomization(!showCustomization)}
                    className="text-[11px] text-ink-faint hover:text-accent transition-colors flex items-center gap-1.5"
                  >
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="8" cy="8" r="3" />
                      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
                    </svg>
                    {showCustomization ? "Hide video customization" : "Customize avatar & voice"}
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
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Hook reasoning */}
              {buildResult.hook && showHookReasoning && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-accent/15 bg-white p-4 text-sm text-ink-muted leading-relaxed"
                >
                  <span className="text-[10px] uppercase tracking-widest font-semibold text-accent block mb-1">
                    Agent reasoning
                  </span>
                  <p>{buildResult.hook.reasoning}</p>
                  {buildResult.hook.formatReasoning && (
                    <p className="mt-2">{buildResult.hook.formatReasoning}</p>
                  )}
                </motion.div>
              )}

              {/* Generated outputs */}
              <div className="space-y-4">
                {/* Visual outputs: images + hook video */}
                <OutputGrid nodes={buildResult.nodes} hookStatus={buildResult.hook?.status} />

                {/* Script */}
                <ScriptCard nodes={buildResult.nodes} />
              </div>

              {/* Video result */}
              {videoRenderResult && videoRendering === "done" && (
                <VideoResultSection videoUrl={videoRenderResult.videoUrl} composed={videoComposed} />
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
                    {captureIntent === "download" ? "Export canvas" : captureIntent === "share" ? "Get share link" : "Render HeyGen video"}
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
                {captureIntent === "download" && "Drop your email to export this canvas as a ZIP file from Melius."}
                {captureIntent === "share" && "Drop your email to get a shareable campaign link."}
                {captureIntent === "render" && "Drop your email to render a HeyGen video from this canvas."}
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
                  {captureLoading ? "Processing…" : captureIntent === "download" ? "Export canvas" : captureIntent === "share" ? "Get share link" : "Render video"}
                </button>
              </motion.form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default StudioClient;

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function AgentLogPanel({ logIndex }: { logIndex: number }) {
  return (
    <div className="rounded-2xl border border-cream-dark bg-ink text-cream overflow-hidden flex flex-col shadow-[0_4px_30px_-10px_rgba(0,0,0,0.3)] min-h-[220px]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-black/10">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-error/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-warm/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-success/70" />
        </div>
        <span className="text-[10px] font-mono text-cream/50 ml-2">agent.log · mcp tool calls</span>
        <div className="ml-auto flex items-center gap-1.5 text-[9px] font-mono text-accent-soft/80 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span>Live</span>
        </div>
      </div>
      <div className="flex-1 px-5 py-4 space-y-2 overflow-y-auto max-h-[500px] font-mono text-[11px]">
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
        {logIndex === 0 && (
          <div className="text-cream/30 text-center py-6 animate-pulse font-mono text-[11px]">
            Initialising agent...
          </div>
        )}
      </div>
    </div>
  );
}

function OutputGrid({ nodes, hookStatus }: { nodes: StudioNode[]; hookStatus?: string }) {
  const imageNodes = nodes.filter((n) => n.type === "image");
  const videoNode = nodes.find((n) => n.type === "video");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {imageNodes.map((node) => (
        <div key={node.id} className="rounded-xl border border-cream-dark bg-white overflow-hidden">
          <div className="aspect-video bg-cream/50 relative">
            {node.outputUrl ? (
              <img
                src={node.outputUrl}
                alt={node.label}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="w-6 h-6 rounded-full border-2 border-accent/30 border-t-accent animate-spin mx-auto" />
                  <span className="text-[10px] text-ink-faint">Generating…</span>
                </div>
              </div>
            )}
          </div>
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-ink truncate">{node.label}</span>
            <span className="text-[10px] text-ink-faint">{statusIcon(node.status)}</span>
          </div>
        </div>
      ))}

      {videoNode && (
        <div className="rounded-xl border border-cream-dark bg-white overflow-hidden">
          <div className="aspect-video bg-ink relative">
            {videoNode.outputUrl ? (
              <video
                src={videoNode.outputUrl}
                className="w-full h-full object-cover"
                muted
                loop
                autoPlay
                playsInline
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center space-y-2">
                  {hookStatus === "generating" ? (
                    <>
                      <div className="w-6 h-6 rounded-full border-2 border-accent/30 border-t-accent animate-spin mx-auto" />
                      <span className="text-[10px] text-cream/60">Generating hook video…</span>
                    </>
                  ) : (
                    <span className="text-[10px] text-cream/40">Video pending</span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-ink truncate">{videoNode.label}</span>
            <span className="text-[10px] text-ink-faint">{statusIcon(videoNode.status)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ScriptCard({ nodes }: { nodes: StudioNode[] }) {
  const scriptNode = nodes.find((n) => n.label === "Script" && n.type === "custom_text");
  const profileNode = nodes.find((n) => n.label === "Profile Summary" && n.type === "custom_text");

  if (!scriptNode?.prompt) return null;

  return (
    <div className="rounded-xl border border-cream-dark bg-white p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest font-medium text-accent">Script</span>
        {profileNode?.prompt && (
          <span className="text-[10px] text-ink-faint">
            — for {profileNode.prompt.split("—")[0]?.trim() || "recipient"}
          </span>
        )}
      </div>
      <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{scriptNode.prompt}</p>
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

function VideoResultSection({ videoUrl, composed }: { videoUrl: string; composed?: boolean }) {
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
            <p className="text-xs text-ink-muted">{composed ? "Hook + body composed from your Melius canvas" : "Rendered from your Melius canvas"}</p>
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
