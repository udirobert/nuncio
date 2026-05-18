import { NextRequest, NextResponse } from "next/server";
import { enrich } from "@/lib/tinyfish";
import { synthesise, generateScript } from "@/lib/claude";
import { MeliusProvider, resetMeliusSession } from "@/lib/creative/melius-provider";
import type { StudioNode, StudioBuildResult } from "@/lib/creative/melius-provider";

const NODE_GEOMETRY = {
  profileSummary: { x: 0, y: 0, w: 420, h: 140 },
  script: { x: 0, y: 160, w: 420, h: 200 },
  visualDirection: { x: 0, y: 380, w: 420, h: 140 },
  objective: { x: 0, y: 540, w: 420, h: 100 },
  background: { x: 460, y: 0, w: 420, h: 236 },
  thumbnail: { x: 460, y: 256, w: 420, h: 236 },
};

export async function POST(request: NextRequest) {
  try {
    const { url, senderBrief, intent } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const urls = [url];

    // 1. Enrich
    const enrichment = await enrich(urls);
    const markdown = enrichment.filter((r) => r.success).map((r) => r.markdown);
    if (markdown.length === 0) {
      return NextResponse.json({ error: "Could not access profile" }, { status: 400 });
    }

    // 2. Synthesise profile
    const profile = await synthesise(markdown);

    // 3. Generate script
    const script = await generateScript(profile, senderBrief, { intent: intent as Parameters<typeof generateScript>[2] extends { intent: infer I } ? I : undefined });

    // 4. Build Melius canvas
    resetMeliusSession();
    const melius = new MeliusProvider();

    const session = await melius.createSession(profile.name);
    const canvasId = session.id;
    const projectId = melius["projectId"] || "";

    if (!canvasId) {
      throw new Error("Failed to create Melius canvas");
    }

    await melius.claimPresence(canvasId, { x: 0, y: 0, w: 880, h: 600 });

    const role = profile.current_role ? `${profile.current_role}${profile.company ? ` at ${profile.company}` : ""}` : "a professional";
    const bgPrompt = `Professional video background for a personalised outreach to ${profile.name}${profile.company ? ` at ${profile.company}` : ""}. Clean, warm, ${profile.tone} tone. No text, no faces. 16:9.`;
    const thumbPrompt = `Video thumbnail for a personalised message to ${profile.name}. Professional, clean, inviting. 16:9.`;
    const objectiveText = senderBrief || `Personalised video outreach to ${profile.name}`;
    const visualDirection = `Tone: ${profile.tone}, warm, genuine\nStyle: Clean, professional background. Warm lighting.\nTarget: ${profile.name} — ${role}`;
    const profileSummary = `${profile.name} — ${profile.current_role}${profile.company ? ` at ${profile.company}` : ""}\n\nNotable: ${profile.notable_work.join(", ")}\nInterests: ${profile.interests.join(", ")}`;

    // Generate temporary IDs upfront so planLayout can use them
    const NODE_IDS = {
      profileSummary: crypto.randomUUID(),
      script: crypto.randomUUID(),
      visualDirection: crypto.randomUUID(),
      objective: crypto.randomUUID(),
      background: crypto.randomUUID(),
      thumbnail: crypto.randomUUID(),
    };

    const layoutNodes = [
      { id: NODE_IDS.profileSummary, nodeType: "custom_text", ...NODE_GEOMETRY.profileSummary },
      { id: NODE_IDS.script, nodeType: "custom_text", ...NODE_GEOMETRY.script },
      { id: NODE_IDS.visualDirection, nodeType: "custom_text", ...NODE_GEOMETRY.visualDirection },
      { id: NODE_IDS.objective, nodeType: "custom_text", ...NODE_GEOMETRY.objective },
      { id: NODE_IDS.background, nodeType: "image", ...NODE_GEOMETRY.background },
      { id: NODE_IDS.thumbnail, nodeType: "image", ...NODE_GEOMETRY.thumbnail },
    ];

    const positions = await melius.planLayout(canvasId, layoutNodes);
    const geometryKeys = ["profileSummary", "script", "visualDirection", "objective", "background", "thumbnail"] as const;

    function pos(key: typeof geometryKeys[number]): { x: number; y: number; w: number; h: number } {
      const idx = geometryKeys.indexOf(key);
      const p = positions[idx];
      const g = NODE_GEOMETRY[key];
      return p ? { x: p.x, y: p.y, w: g.w, h: g.h } : g;
    }

    const studioNodes: StudioNode[] = [];

    // Text: Profile Summary
    const profileNodeId = await melius.createCustomTextNode(
      canvasId, "Profile Summary", profileSummary, pos("profileSummary")
    );
    studioNodes.push({ id: profileNodeId, label: "Profile Summary", type: "custom_text", status: "complete" });

    // Text: Script
    const scriptNodeId = await melius.createCustomTextNode(
      canvasId, "Script", script, pos("script")
    );
    studioNodes.push({ id: scriptNodeId, label: "Script", type: "custom_text", status: "complete" });

    // Text: Visual Direction
    const visualDirNodeId = await melius.createCustomTextNode(
      canvasId, "Visual Direction", visualDirection, pos("visualDirection")
    );
    studioNodes.push({ id: visualDirNodeId, label: "Visual Direction", type: "custom_text", status: "complete" });

    // Text: Outreach Objective
    const objectiveNodeId = await melius.createCustomTextNode(
      canvasId, "Outreach Objective", objectiveText, pos("objective")
    );
    studioNodes.push({ id: objectiveNodeId, label: "Outreach Objective", type: "custom_text", status: "complete" });

    // Image: Background
    const bgNodeId = await melius.createImageNode(
      canvasId, "Video Background", bgPrompt, pos("background")
    );
    studioNodes.push({ id: bgNodeId, label: "Video Background", type: "image", status: "pending", prompt: bgPrompt });

    // Image: Thumbnail
    const thumbNodeId = await melius.createImageNode(
      canvasId, "Video Thumbnail", thumbPrompt, pos("thumbnail")
    );
    studioNodes.push({ id: thumbNodeId, label: "Video Thumbnail", type: "image", status: "pending", prompt: thumbPrompt });

    // Wire edges: text → images (so image prompts have context)
    await melius.bulkCreateEdges(canvasId, [
      { sourceNodeId: profileNodeId, targetNodeId: bgNodeId, type: "text" },
      { sourceNodeId: visualDirNodeId, targetNodeId: bgNodeId, type: "text" },
      { sourceNodeId: profileNodeId, targetNodeId: thumbNodeId, type: "text" },
      { sourceNodeId: visualDirNodeId, targetNodeId: thumbNodeId, type: "text" },
    ]);

    // Group all nodes
    const allNodeIds = [profileNodeId, scriptNodeId, visualDirNodeId, objectiveNodeId, bgNodeId, thumbNodeId];
    await melius.createGroupNode(canvasId, `${profile.name} — Video Outreach`, allNodeIds);

    // Add audit comment
    await melius.addComment(canvasId, `nuncio studio session for ${profile.name}. Built automatically from profile URL.`, 0, -80);

    // Release presence
    await melius.releasePresence(canvasId);

    // Start image generation
    const bgRunId = await melius.startRun(bgNodeId, canvasId);
    const thumbRunId = await melius.startRun(thumbNodeId, canvasId);

    // Update node statuses
    studioNodes.forEach((n) => {
      if (n.id === bgNodeId || n.id === thumbNodeId) {
        n.status = "generating";
      }
    });

    // Poll for completion (non-blocking — return early, let client poll canvas endpoint)
    melius.getRunStatus(bgRunId, canvasId).then((result) => {
      const node = studioNodes.find((n) => n.id === bgNodeId);
      if (node) {
        node.status = result.outputUrl ? "complete" : "failed";
        node.outputUrl = result.outputUrl;
      }
    }).catch(() => {});

    melius.getRunStatus(thumbRunId, canvasId).then((result) => {
      const node = studioNodes.find((n) => n.id === thumbNodeId);
      if (node) {
        node.status = result.outputUrl ? "complete" : "failed";
        node.outputUrl = result.outputUrl;
      }
    }).catch(() => {});

    const result: StudioBuildResult = {
      projectId,
      canvasId,
      canvasUrl: session.canvasUrl || `https://app.melius.com/canvas/${canvasId}`,
      embedUrl: `https://app.melius.com/canvas/${canvasId}/embed`,
      nodes: studioNodes,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("[studio/build] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Studio build failed" },
      { status: 500 }
    );
  }
}
