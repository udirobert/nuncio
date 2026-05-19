import { NextRequest, NextResponse } from "next/server";
import { enrich } from "@/lib/tinyfish";
import { synthesise, generateScript } from "@/lib/claude";
import { MeliusProvider, resetMeliusSession } from "@/lib/creative/melius-provider";
import type { StudioNode, StudioBuildResult } from "@/lib/creative/melius-provider";
import { chooseArchetype } from "@/lib/hooks/select";
import { generateHookVideo } from "@/lib/hooks/generate";
import { ensureTrialCookie, resolveHookAccess } from "@/lib/hooks/tiers";
import { pickFormat, type HookArchetypeId } from "@/lib/hooks/archetypes";

const NODE_GEOMETRY = {
  profileSummary: { x: 0, y: 0, w: 420, h: 140 },
  script: { x: 0, y: 160, w: 420, h: 200 },
  visualDirection: { x: 0, y: 380, w: 420, h: 140 },
  objective: { x: 0, y: 540, w: 420, h: 100 },
  background: { x: 460, y: 0, w: 420, h: 236 },
  thumbnail: { x: 460, y: 256, w: 420, h: 236 },
  hookConcept: { x: 920, y: 0, w: 420, h: 160 },
  hookVideo: { x: 920, y: 180, w: 420, h: 236 },
};

export async function POST(request: NextRequest) {
  try {
    const { url, senderBrief, intent, email, archetype } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const urls = [url];

    // 1. Enrich with profile discovery
    const enrichment = await enrich(urls, { discoverRelated: true });
    const markdown = enrichment.filter((r) => r.success).map((r) => r.markdown);
    if (markdown.length === 0) {
      return NextResponse.json({ error: "Could not access profile" }, { status: 400 });
    }

    // 2. Synthesise profile
    const profile = await synthesise(markdown);

    // 3. Generate script
    const script = await generateScript(profile, senderBrief, { intent: intent as Parameters<typeof generateScript>[2] extends { intent: infer I } ? I : undefined });
    const hookChoice = chooseArchetype(profile, senderBrief, archetype as HookArchetypeId | undefined);
    const hookFormat = pickFormat(profile);
    const hookAccess = resolveHookAccess(request, typeof email === "string" ? email : null);
    const hookGeneration = await generateHookVideo({
      prompt: hookChoice.prompt,
      modelEndpoint: hookAccess.modelEndpoint,
      tier: hookAccess.tier,
      generationAllowed: hookAccess.generationAllowed,
      aspectRatio: hookFormat.aspectRatio,
      durationSeconds: Math.min(5, hookFormat.durationSeconds),
    });

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
      hookConcept: crypto.randomUUID(),
      hookVideo: crypto.randomUUID(),
    };

    const layoutNodes = [
      { id: NODE_IDS.profileSummary, nodeType: "custom_text", ...NODE_GEOMETRY.profileSummary },
      { id: NODE_IDS.script, nodeType: "custom_text", ...NODE_GEOMETRY.script },
      { id: NODE_IDS.visualDirection, nodeType: "custom_text", ...NODE_GEOMETRY.visualDirection },
      { id: NODE_IDS.objective, nodeType: "custom_text", ...NODE_GEOMETRY.objective },
      { id: NODE_IDS.background, nodeType: "image", ...NODE_GEOMETRY.background },
      { id: NODE_IDS.thumbnail, nodeType: "image", ...NODE_GEOMETRY.thumbnail },
      { id: NODE_IDS.hookConcept, nodeType: "custom_text", ...NODE_GEOMETRY.hookConcept },
      { id: NODE_IDS.hookVideo, nodeType: "video", ...NODE_GEOMETRY.hookVideo },
    ];

    let positions: { x: number; y: number }[] = [];
    try {
      positions = await melius.planLayout(canvasId, layoutNodes);
    } catch (error) {
      console.warn("[studio/build] Layout planning failed, using static Hook Engine layout:", error);
    }
    const geometryKeys = ["profileSummary", "script", "visualDirection", "objective", "background", "thumbnail", "hookConcept", "hookVideo"] as const;

    function pos(key: typeof geometryKeys[number]): { x: number; y: number; w: number; h: number } {
      const idx = geometryKeys.indexOf(key);
      const p = positions[idx];
      const g = NODE_GEOMETRY[key];
      return p ? { x: p.x, y: p.y, w: g.w, h: g.h } : g;
    }

    const studioNodes: StudioNode[] = [];

    // Text: Profile Summary — why this node exists
    const profileNodeId = await melius.createCustomTextNode(
      canvasId, "Profile Summary", profileSummary, pos("profileSummary")
    );
    studioNodes.push({
      id: profileNodeId, label: "Profile Summary", type: "custom_text", status: "complete",
      reasoning: "Distilling the enriched profile into key facts — role, company, notable work, interests — to seed the script and image prompts with real context.",
    });

    // Text: Script
    const scriptNodeId = await melius.createCustomTextNode(
      canvasId, "Script", script, pos("script")
    );
    studioNodes.push({
      id: scriptNodeId, label: "Script", type: "custom_text", status: "complete",
      reasoning: "Drafting a personalised outreach script that references specific details from the enriched profile to make the message feel researched, not templated.",
    });

    // Text: Visual Direction
    const visualDirNodeId = await melius.createCustomTextNode(
      canvasId, "Visual Direction", visualDirection, pos("visualDirection")
    );
    studioNodes.push({
      id: visualDirNodeId, label: "Visual Direction", type: "custom_text", status: "complete",
      reasoning: "Setting the visual tone, palette, and style constraints so image nodes generate on-brand, coherent outputs that match the recipient's context.",
    });

    // Text: Outreach Objective
    const objectiveNodeId = await melius.createCustomTextNode(
      canvasId, "Outreach Objective", objectiveText, pos("objective")
    );
    studioNodes.push({
      id: objectiveNodeId, label: "Outreach Objective", type: "custom_text", status: "complete",
      reasoning: "Capturing the sender's intent and call-to-action so every creative decision ties back to the campaign goal rather than drifting into generic content.",
    });

    // Image: Background
    const bgNodeId = await melius.createImageNode(
      canvasId, "Video Background", bgPrompt, pos("background")
    );
    studioNodes.push({
      id: bgNodeId, label: "Video Background", type: "image", status: "pending", prompt: bgPrompt,
      reasoning: "Seeding a cinematic 16:9 background prompt that reflects the recipient's professional context — no faces, no logos, no readable text — so the video backdrop feels intentional.",
    });

    // Image: Thumbnail
    const thumbNodeId = await melius.createImageNode(
      canvasId, "Video Thumbnail", thumbPrompt, pos("thumbnail")
    );
    studioNodes.push({
      id: thumbNodeId, label: "Video Thumbnail", type: "image", status: "pending", prompt: thumbPrompt,
      reasoning: "Generating a clean, inviting thumbnail prompt — the first visual the recipient sees when the message lands, so it needs to earn the click.",
    });

    // Hook Engine: concept + cinematic video node
    const hookConceptText = [
      hookChoice.concept,
      "",
      `Archetype: ${hookChoice.archetype.label}`,
      `Reasoning: ${hookChoice.reasoning}`,
      `Format: ${hookFormat.label}`,
      `Format reasoning: ${hookFormat.reasoning}`,
      `Model: ${hookAccess.modelLabel}`,
      hookAccess.reason ? `Mode: ${hookAccess.reason}` : "",
    ].filter(Boolean).join("\n");

    const hookConceptNodeId = await melius.createCustomTextNode(
      canvasId, "Hook Concept", hookConceptText, pos("hookConcept")
    );
    studioNodes.push({
      id: hookConceptNodeId, label: "Hook Concept", type: "custom_text", status: "complete", prompt: hookConceptText,
      reasoning: "Documenting the Hook Engine's archetype selection, format decision, and reasoning so the creative strategy is traceable and editable in the canvas.",
    });

    let hookVideoNodeId: string | null = null;
    try {
      hookVideoNodeId = await melius.createVideoNode(
        canvasId,
        "Hook Cinematic",
        hookChoice.prompt,
        pos("hookVideo"),
        hookGeneration.outputUrl
      );
      studioNodes.push({
        id: hookVideoNodeId,
        label: "Hook Cinematic",
        type: "video",
        status: hookGeneration.outputUrl ? "complete" : hookGeneration.status === "failed" ? "failed" : "pending",
        prompt: hookChoice.prompt,
        outputUrl: hookGeneration.outputUrl,
        reasoning: "Placing a short cinematic video hook tailored to the recipient's archetype — the attention-grabber that stops the scroll before the main message plays.",
      });
    } catch (error) {
      console.warn("[studio/build] Hook video node creation failed:", error);
      hookVideoNodeId = null;
    }

    // Wire edges: text → images (so image prompts have context)
    const edges = [
      { sourceNodeId: profileNodeId, targetNodeId: bgNodeId, type: "text" },
      { sourceNodeId: visualDirNodeId, targetNodeId: bgNodeId, type: "text" },
      { sourceNodeId: profileNodeId, targetNodeId: thumbNodeId, type: "text" },
      { sourceNodeId: visualDirNodeId, targetNodeId: thumbNodeId, type: "text" },
    ];
    if (hookVideoNodeId) {
      edges.push(
        { sourceNodeId: hookConceptNodeId, targetNodeId: hookVideoNodeId, type: "text" },
        { sourceNodeId: visualDirNodeId, targetNodeId: hookVideoNodeId, type: "text" }
      );
    }
    await melius.bulkCreateEdges(canvasId, edges);

    // Group all nodes
    const allNodeIds = [profileNodeId, scriptNodeId, visualDirNodeId, objectiveNodeId, bgNodeId, thumbNodeId, hookConceptNodeId, hookVideoNodeId].filter(Boolean) as string[];
    await melius.createGroupNode(canvasId, `${profile.name} — Video Outreach`, allNodeIds);

    // Add audit comment
    await melius.addComment(
      canvasId,
      `nuncio studio session for ${profile.name}. Hook Engine chose ${hookChoice.archetype.label}: ${hookChoice.reasoning}`,
      0,
      -80
    );

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
      hook: {
        archetype: hookChoice.archetype.label,
        reasoning: hookChoice.reasoning,
        model: hookAccess.modelLabel,
        tier: hookAccess.tier,
        remainingFree: hookAccess.remainingFree,
        canRegenerate: hookAccess.canRegenerate,
        watermark: hookAccess.watermark,
        status: hookGeneration.outputUrl ? "complete" : hookGeneration.status,
        format: hookFormat.label,
        formatReasoning: hookFormat.reasoning,
        outputUrl: hookGeneration.outputUrl,
        warning: hookAccess.reason || hookGeneration.error,
      },
    };

    const response = NextResponse.json(result);
    ensureTrialCookie(response, request);
    return response;
  } catch (error) {
    console.error("[studio/build] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Studio build failed" },
      { status: 500 }
    );
  }
}
