import { NextRequest, NextResponse } from "next/server";
import { MeliusProvider, resetMeliusSession } from "@/lib/creative/melius-provider";

export async function POST(request: NextRequest) {
  try {
    const { nodeId, prompt, canvasId } = await request.json();

    if (!nodeId) {
      return NextResponse.json({ error: "nodeId is required" }, { status: 400 });
    }

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    resetMeliusSession();
    const melius = new MeliusProvider();

    if (canvasId) {
      await melius.claimPresence(canvasId, { x: 0, y: 0, w: 880, h: 600 });
    }

    // Update the node's prompt
    await melius.updateNodePrompt(nodeId, prompt, canvasId);

    // Re-run generation
    const runId = await melius.startRun(nodeId, canvasId);

    // Poll for completion (up to 30s)
    let status = "running";
    let outputUrl: string | undefined;
    const pollStart = Date.now();

    while (status === "running" && Date.now() - pollStart < 30000) {
      await new Promise((r) => setTimeout(r, 2000));
      const runStatus = await melius.getRunStatus(runId, canvasId);
      status = runStatus.status;
      if (runStatus.outputUrl) {
        outputUrl = runStatus.outputUrl;
      }
    }

    if (canvasId) {
      await melius.releasePresence(canvasId);
    }

    return NextResponse.json({
      runId,
      status: outputUrl ? "complete" : status,
      outputUrl,
    });
  } catch (error) {
    console.error("[studio/iterate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Iteration failed" },
      { status: 500 }
    );
  }
}
