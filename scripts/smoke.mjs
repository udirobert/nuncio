#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const OUT_DIR = process.env.SMOKE_OUT_DIR || "artifacts/test-runs";
const RUN_EXTERNAL = process.env.SMOKE_EXTERNAL === "1";
const RUN_LLM = process.env.SMOKE_LLM === "1";
const RUN_VIDEO = process.env.SMOKE_VIDEO === "1";
const RUN_LIVE = process.env.SMOKE_LIVE === "1";
const LIVE_CONFIRM = process.env.SMOKE_LIVE_CONFIRM === "1";
let liveExecuted = false;
let liveCleanupNeedsReview = false;
const startedAt = new Date();
const results = [];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const server = await ensureServer();

  try {
    await testShareRoundTrip();
    await testScriptFallbackTiming();

    if (RUN_EXTERNAL) {
      await testTinyFishTiming();
    }

    if (RUN_LLM) {
      await testScriptLlmTiming();
    }

    if (RUN_VIDEO) {
      await testHeyGenStartOnly();
    }

    if (RUN_LIVE) {
      await testLiveLinkTokenAndCleanup();
    }
  } finally {
    if (server) server.kill("SIGTERM");
    await saveResults();
  }

  if (liveCleanupNeedsReview) {
    console.warn("⚠ LiveLink cleanup needs review: check /api/live/expire and the credit ledger before rerunning.");
  }

  if (results.some((result) => result.ok === false)) {
    process.exitCode = 1;
  }
}

async function ensureServer() {
  if (await isReachable()) return null;

  const child = spawn("pnpm", ["dev"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  const logs = [];
  child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  child.stderr.on("data", (chunk) => logs.push(chunk.toString()));

  for (let i = 0; i < 40; i++) {
    await sleep(500);
    if (await isReachable()) return child;
  }

  child.kill("SIGTERM");
  throw new Error(`Dev server did not start. Logs:\n${logs.join("").slice(-2000)}`);
}

async function isReachable() {
  try {
    const response = await fetch(BASE_URL, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function testShareRoundTrip() {
  await timed("share.round_trip", async () => {
    const created = await post("/api/share", {
      videoUrl: "https://example.com/smoke.mp4",
      recipientName: "Smoke Test",
      trace: [{ label: "Smoke", detail: "Share round-trip", status: "complete" }],
    });

    const fetched = await get(`/api/share/${created.record.id}`);
    assert(fetched.videoUrl === "https://example.com/smoke.mp4", "share videoUrl mismatch");
    return { shareId: created.record.id, sharePath: created.shareUrl };
  });
}

async function testScriptFallbackTiming() {
  await timed("script.fallback_short_enrichment", async () => {
    const data = await post("/api/script", {
      enrichment: [
        "# Ada Lovelace\nPioneer of computing. Wrote notes on the Analytical Engine. Interested in mathematics, computation, and creative technology.",
      ],
      senderBrief: "Testing resilient script generation for demo readiness.",
      forceFallback: true,
    }, 30000);

    assert(data.profile?.name, "missing profile name");
    assert(data.script?.split(/\s+/).length >= 10, "script too short");
    return {
      profileName: data.profile.name,
      hookCount: data.profile.personalization_hooks?.length || 0,
      scriptWords: data.script.split(/\s+/).length,
    };
  });
}

async function testScriptLlmTiming() {
  await timed("script.llm_short_enrichment", async () => {
    const data = await post("/api/script", {
      enrichment: [
        "# Ada Lovelace\nPioneer of computing. Wrote notes on the Analytical Engine. Interested in mathematics, computation, and creative technology.",
      ],
      senderBrief: "Testing live LLM script generation timing.",
    }, 30000);

    assert(data.profile?.name, "missing profile name");
    assert(data.script?.split(/\s+/).length >= 10, "script too short");
    return {
      profileName: data.profile.name,
      hookCount: data.profile.personalization_hooks?.length || 0,
      scriptWords: data.script.split(/\s+/).length,
    };
  });
}

async function testTinyFishTiming() {
  await timed("tinyfish.single_url", async () => {
    const data = await post("/api/enrich", {
      urls: [process.env.SMOKE_PROFILE_URL || "https://github.com/vercel/next.js"],
    }, 30000);
    const successes = data.filter((item) => item.success);
    assert(successes.length > 0, "no enrichment succeeded");
    return {
      successes: successes.length,
      chars: successes[0].markdown.length,
      url: successes[0].url,
    };
  });
}

async function testHeyGenStartOnly() {
  await timed("heygen.start_only", async () => {
    const data = await post("/api/video", {
      script: "Hey there — this is a short nuncio smoke test video. It checks whether the HeyGen job can start successfully without running the full outreach pipeline.",
      recipientName: "Smoke Test",
      assetUrls: [],
    }, 45000);
    assert(data.videoId, "missing videoId");
    return { videoId: data.videoId };
  });
}

async function testLiveLinkTokenAndCleanup() {
  await timed("livelink.token_and_cleanup", async () => {
    if (!LIVE_CONFIRM) {
      throw new Error("SMOKE_LIVE_CONFIRM=1 is required because this test calls the metered Anam provider");
    }
    if (process.env.NUNCIO_CREDITS_ENFORCED !== "true") {
      throw new Error("NUNCIO_CREDITS_ENFORCED=true is required before running the metered LiveLink smoke test");
    }

    const shareId = process.env.SMOKE_LIVE_SHARE_ID;
    if (!shareId) {
      throw new Error("SMOKE_LIVE_SHARE_ID is required and must identify a dedicated allowlisted test share");
    }

    let session;
    let cleanupCompleted = false;
    try {
      liveExecuted = true;
      session = await post("/api/live/session", { shareId }, 30000);
      assert(session.sessionId, "missing live sessionId");
      assert(session.syncToken, "missing live syncToken");
      assert(session.sessionToken, "missing Anam session token");

      const synced = await post("/api/live/sync", {
        sessionId: session.sessionId,
        shareId,
        durationMs: 0,
        reason: "manual",
        syncToken: session.syncToken,
      }, 15000);
      assert(synced.status === "ended", `unexpected live cleanup status: ${synced.status}`);
      cleanupCompleted = true;

      return {
        shareId,
        sessionId: session.sessionId,
        cleanupStatus: synced.status,
        chargedCredits: synced.chargedCredits,
      };
    } finally {
      // The smoke path never retries. If token creation succeeded but the
      // normal sync failed, make one bounded best-effort cleanup attempt.
      if (!cleanupCompleted && session?.sessionId && session?.syncToken) {
        await post("/api/live/sync", {
          sessionId: session.sessionId,
          shareId,
          durationMs: 0,
          reason: "manual",
          syncToken: session.syncToken,
        }, 5000).catch(() => {
          liveCleanupNeedsReview = true;
        });
      } else if (liveExecuted) {
        // A provider/network failure may have created a durable session even
        // though the response was incomplete. Surface this explicitly so an
        // operator checks /api/live/expire and the credit ledger before retrying.
        liveCleanupNeedsReview = true;
      }
    }
  });
}

async function timed(name, fn) {
  const start = performance.now();
  try {
    const details = await fn();
    const durationMs = Math.round(performance.now() - start);
    const result = { name, ok: true, durationMs, details };
    results.push(result);
    console.log(`✓ ${name} ${durationMs}ms`, details || "");
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    const result = {
      name,
      ok: false,
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    };
    results.push(result);
    console.error(`✗ ${name} ${durationMs}ms`, result.error);
  }
}

async function post(pathname, body, timeoutMs = 15000) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return parseResponse(response);
}

async function get(pathname, timeoutMs = 15000) {
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

  if (!response.ok) {
    throw new Error(`${response.status}: ${JSON.stringify(data).slice(0, 500)}`);
  }

  return data;
}

async function saveResults() {
  const endedAt = new Date();
  const summary = {
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    totalDurationMs: endedAt.getTime() - startedAt.getTime(),
    baseUrl: BASE_URL,
    external: RUN_EXTERNAL,
    llm: RUN_LLM,
    video: RUN_VIDEO,
    liveRequested: RUN_LIVE,
    liveConfirmationProvided: LIVE_CONFIRM,
    liveExecuted,
    liveCleanupNeedsReview,
    results,
  };
  const file = path.join(
    OUT_DIR,
    `${startedAt.toISOString().replace(/[:.]/g, "-")}-smoke.json`
  );
  await writeFile(file, JSON.stringify(summary, null, 2), "utf8");
  console.log(`Saved smoke results: ${file}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(async (error) => {
  results.push({ name: "runner", ok: false, error: error.message });
  await saveResults();
  console.error(error);
  process.exit(1);
});