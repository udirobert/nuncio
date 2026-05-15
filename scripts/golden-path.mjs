#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const BASE_URL = process.env.GOLDEN_BASE_URL || "http://localhost:3000";
const OUT_DIR = process.env.GOLDEN_OUT_DIR || "artifacts/test-runs/golden";
const PROFILE_URLS = (process.env.GOLDEN_PROFILE_URLS || process.env.GOLDEN_PROFILE_URL || "https://github.com/vercel/next.js")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
const SENDER_BRIEF = process.env.GOLDEN_SENDER_BRIEF ||
  "I am building nuncio, an agentic personalized video pipeline for high-context developer and founder outreach, and I would love feedback on making AI-native product demos feel more personal.";
const SKIP_CANVAS = process.env.GOLDEN_SKIP_CANVAS === "1";
const SKIP_VIDEO = process.env.GOLDEN_SKIP_VIDEO === "1";
const VIDEO_TIMEOUT_MS = Number(process.env.GOLDEN_VIDEO_TIMEOUT_MS || 10 * 60 * 1000);

const startedAt = new Date();
const timings = {};

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(`Usage: pnpm golden

Environment:
  GOLDEN_PROFILE_URL=https://github.com/vercel/next.js
  GOLDEN_PROFILE_URLS=url1,url2
  GOLDEN_SENDER_BRIEF="..."
  GOLDEN_SKIP_CANVAS=1
  GOLDEN_SKIP_VIDEO=1
  GOLDEN_VIDEO_TIMEOUT_MS=600000
`);
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });
  const server = await ensureServer();

  try {
    const enrichment = await timed("enrich", () => post("/api/enrich", { urls: PROFILE_URLS }, 45000));
    const markdown = enrichment.filter((item) => item.success).map((item) => item.markdown);
    assert(markdown.length > 0, "No enrichment succeeded");

    const scriptData = await timed("script", () => post("/api/script", {
      enrichment: markdown,
      senderBrief: SENDER_BRIEF,
    }, 45000));

    let canvasData = null;
    if (!SKIP_CANVAS) {
      canvasData = await timed("canvas", () => post("/api/canvas", {
        profile: scriptData.profile,
        script: scriptData.script,
      }, 120000));
    }

    let videoStart = null;
    let videoStatus = null;
    if (!SKIP_VIDEO) {
      videoStart = await timed("videoStart", () => post("/api/video", {
        script: scriptData.script,
        assetUrls: canvasData?.assetUrls || [],
        recipientName: scriptData.profile.name,
      }, 60000));

      videoStatus = await timed("videoComplete", () => pollVideo(videoStart.videoId));
    }

    const share = await timed("share", () => post("/api/share", {
      videoUrl: videoStatus?.videoUrl || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      videoId: videoStart?.videoId,
      recipientName: scriptData.profile.name,
      profile: scriptData.profile,
      sources: PROFILE_URLS,
      canvas: canvasData ? {
        canvasId: canvasData.canvasId,
        provider: canvasData.provider,
        assetCount: canvasData.assetCount,
        canvasUrl: canvasData.canvasUrl,
        exportUrl: canvasData.exportUrl,
      } : undefined,
      trace: [
        { label: "Golden path sources", detail: PROFILE_URLS.join(", "), status: "complete" },
        { label: "Generated script", detail: `${scriptData.script.split(/\s+/).length} words`, status: "complete" },
        ...(videoStart ? [{ label: "Started HeyGen render", detail: videoStart.videoId, status: "complete" }] : []),
      ],
    }, 30000));

    await save({
      ok: true,
      profileUrls: PROFILE_URLS,
      senderBrief: SENDER_BRIEF,
      timings,
      profile: scriptData.profile,
      script: scriptData.script,
      canvas: canvasData,
      video: videoStart ? { ...videoStart, ...videoStatus } : null,
      share,
    });
  } catch (error) {
    await save({
      ok: false,
      profileUrls: PROFILE_URLS,
      senderBrief: SENDER_BRIEF,
      timings,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    if (server) server.kill("SIGTERM");
  }
}

async function pollVideo(videoId) {
  const started = Date.now();
  let last;
  while (Date.now() - started < VIDEO_TIMEOUT_MS) {
    await sleep(15000);
    last = await get(`/api/video/${videoId}`, 30000);
    console.log("video status", last);
    if (last.status === "completed" && last.videoUrl) return last;
    if (last.status === "failed") {
      throw new Error(last.failureMessage || "Video generation failed");
    }
  }
  throw new Error(`Video did not complete within ${VIDEO_TIMEOUT_MS}ms. Last status: ${JSON.stringify(last)}`);
}

async function timed(name, fn) {
  const start = performance.now();
  const result = await fn();
  timings[name] = Math.round(performance.now() - start);
  console.log(`✓ ${name} ${timings[name]}ms`);
  return result;
}

async function ensureServer() {
  if (await isReachable()) return null;
  const child = spawn("pnpm", ["dev"], { stdio: "ignore", env: process.env });
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    if (await isReachable()) return child;
  }
  child.kill("SIGTERM");
  throw new Error("Dev server did not start");
}

async function isReachable() {
  try {
    const response = await fetch(BASE_URL, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function post(pathname, body, timeoutMs) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return parseResponse(response);
}

async function get(pathname, timeoutMs) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  return parseResponse(response);
}

async function parseResponse(response) {
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(data).slice(0, 500)}`);
  return data;
}

async function save(data) {
  const file = path.join(OUT_DIR, `${startedAt.toISOString().replace(/[:.]/g, "-")}-golden.json`);
  await writeFile(file, JSON.stringify({
    startedAt: startedAt.toISOString(),
    endedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    ...data,
  }, null, 2), "utf8");
  console.log(`Saved golden artifact: ${file}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});