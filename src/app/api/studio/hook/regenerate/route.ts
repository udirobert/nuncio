import { NextRequest, NextResponse } from "next/server";
import { MeliusProvider, resetMeliusSession } from "@/lib/creative/melius-provider";
import { generateHookVideo } from "@/lib/hooks/generate";
import { resolveHookAccess } from "@/lib/hooks/tiers";

export async function POST(request: NextRequest) {
  try {
    const { canvasId, nodeId, prompt, email } = await request.json();

    if (!canvasId) {
      return NextResponse.json({ error: "canvasId is required" }, { status: 400 });
    }
    if (!nodeId) {
      return NextResponse.json({ error: "nodeId is required" }, { status: 400 });
    }
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: "email is required to unlock rerolls" }, { status: 401 });
    }

    const access = resolveHookAccess(request, String(email));
    const generation = await generateHookVideo({
      prompt,
      modelEndpoint: access.modelEndpoint,
      tier: access.tier,
      generationAllowed: access.generationAllowed,
    });

    if (generation.outputUrl) {
      resetMeliusSession();
      const melius = new MeliusProvider();
      await melius.attachVideoToNode(nodeId, generation.outputUrl, canvasId);
    }

    return NextResponse.json({
      status: generation.outputUrl ? "complete" : generation.status,
      outputUrl: generation.outputUrl,
      warning: access.reason || generation.error,
      tier: access.tier,
      remainingFree: access.remainingFree,
      canRegenerate: access.canRegenerate,
    });
  } catch (error) {
    console.error("[studio/hook/regenerate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Hook regeneration failed" },
      { status: 500 }
    );
  }
}
