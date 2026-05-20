import { NextRequest } from "next/server";
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
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const { url, senderBrief, intent, email, archetype } = await request.json();

        if (!url) {
          send({ error: "url is required" });
          controller.close();
          return;
        }

        const urls = [url];

        // 1. Enrich
        send({ phase: "enrich", status: "Reading public profile...", detail: "Fetching markdown + discovering related URLs" });
        const enrichment = await enrich(urls, { discoverRelated: true });
        const markdown = enrichment.filter((r) => r.success).map((r) => r.markdown);
        if (markdown.length === 0) {
          send({ error: "Could not access profile" });
          controller.close();
          return;
        }

        // 2. Synthesise
        send({ phase: "synthesise", status: "Parsing surface signals...", detail: "Role · company · notable work · interests · tone" });
        const profile = await synthesise(markdown);

        // 3. Generate script
        send({ phase: "synthesise", status: "Drafting outreach script...", detail: "Conversational, < 90 seconds, specific" });
        const script = await generateScript(profile, senderBrief, { intent: intent as Parameters<typeof generateScript>[2] extends { intent: infer I } ? I : undefined });
        const hookChoice = chooseArchetype(profile, senderBrief, archetype as HookArchetypeId | undefined);
        const hookFormat = pickFormat(profile);
        const hookAccess = resolveHookAccess(request, typeof email === "string" ? email : null);

        // 4. Build Melius canvas
        resetMeliusSession();
        const melius = new MeliusProvider();

        send({ phase: "canvas", status: "Initialising Melius session...", detail: "MCP session initialised" });
        const session = await melius.createSession(profile.name);
        const canvasId = session.id;
        const projectId = melius["projectId"] || "";

        if (!canvasId) {
          throw new Error("Failed to create Melius canvas");
        }

        // Ensure visibility is public for non-logged-in users
        try {
          if (projectId) {
            await melius.updateProjectVisibility(projectId, "public");
          }
        } catch (error) {
          console.warn("[studio/build] Visibility update failed:", error);
        }

        // Send canvas info immediately so client can show iframe
        send({
          phase: "canvas",
          status: "Opening a fresh Melius canvas",
          detail: `Canvas created: ${canvasId}`,
          canvas: {
            projectId,
            canvasId,
            canvasUrl: session.canvasUrl || `https://app.melius.com/canvas/${canvasId}`,
            embedUrl: `https://app.melius.com/canvas/${canvasId}/embed`,
          }
        });

        await melius.claimPresence(canvasId, { x: 0, y: 0, w: 880, h: 600 });

        const role = profile.current_role ? `${profile.current_role}${profile.company ? ` at ${profile.company}` : ""}` : "a professional";
        const bgPrompt = `Professional video background for a personalised outreach to ${profile.name}${profile.company ? ` at ${profile.company}` : ""}. Clean, warm, ${profile.tone} tone. No text, no faces. 16:9.`;
        const thumbPrompt = `Video thumbnail for a personalised message to ${profile.name}. Professional, clean, inviting. 16:9.`;
        const objectiveText = senderBrief || `Personalised video outreach to ${profile.name}`;
        const visualDirection = `Tone: ${profile.tone}, warm, genuine\nStyle: Clean, professional background. Warm lighting.\nTarget: ${profile.name} — ${role}`;
        const profileSummary = `${profile.name} — ${profile.current_role}${profile.company ? ` at ${profile.company}` : ""}\n\nNotable: ${profile.notable_work.join(", ")}\nInterests: ${profile.interests.join(", ")}`;

        // Generate temporary IDs upfront
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

        send({ phase: "canvas", status: "Planning node layout", detail: "8 nodes · grid-snapped" });
        let positions: { x: number; y: number }[] = [];
        try {
          positions = await melius.planLayout(canvasId, layoutNodes);
        } catch (error) {
          console.warn("[studio/build] Layout planning failed:", error);
        }
        const geometryKeys = ["profileSummary", "script", "visualDirection", "objective", "background", "thumbnail", "hookConcept", "hookVideo"] as const;

        function pos(key: typeof geometryKeys[number]): { x: number; y: number; w: number; h: number } {
          const idx = geometryKeys.indexOf(key);
          const p = positions[idx];
          const g = NODE_GEOMETRY[key];
          return p ? { x: p.x, y: p.y, w: g.w, h: g.h } : g;
        }

        const studioNodes: StudioNode[] = [];

        // Helper to send node updates
        const sendNode = (node: StudioNode) => {
          studioNodes.push(node);
          send({ phase: "nodes", node });
        };

        // Text nodes
        send({ phase: "nodes", status: "Placing Profile Summary", detail: "node_type: custom_text" });
        const profileNodeId = await melius.createCustomTextNode(canvasId, "Profile Summary", profileSummary, pos("profileSummary"));
        sendNode({ id: profileNodeId, label: "Profile Summary", type: "custom_text", status: "complete", reasoning: "Distilling the enriched profile into key facts." });

        send({ phase: "nodes", status: "Placing Script", detail: "node_type: custom_text" });
        const scriptNodeId = await melius.createCustomTextNode(canvasId, "Script", script, pos("script"));
        sendNode({ id: scriptNodeId, label: "Script", type: "custom_text", status: "complete", reasoning: "Drafting a personalised outreach script." });

        send({ phase: "nodes", status: "Placing Visual Direction", detail: "node_type: custom_text" });
        const visualDirNodeId = await melius.createCustomTextNode(canvasId, "Visual Direction", visualDirection, pos("visualDirection"));
        sendNode({ id: visualDirNodeId, label: "Visual Direction", type: "custom_text", status: "complete", reasoning: "Setting the visual tone and style constraints." });

        send({ phase: "nodes", status: "Placing Outreach Objective", detail: "node_type: custom_text" });
        const objectiveNodeId = await melius.createCustomTextNode(canvasId, "Outreach Objective", objectiveText, pos("objective"));
        sendNode({ id: objectiveNodeId, label: "Outreach Objective", type: "custom_text", status: "complete", reasoning: "Capturing the campaign goal." });

        // Image nodes
        send({ phase: "nodes", status: "Placing Video Background", detail: "node_type: image · prompt seeded" });
        const bgNodeId = await melius.createImageNode(canvasId, "Video Background", bgPrompt, pos("background"));
        sendNode({ id: bgNodeId, label: "Video Background", type: "image", status: "pending", prompt: bgPrompt, reasoning: "Seeding a cinematic 16:9 background prompt." });

        send({ phase: "nodes", status: "Placing Video Thumbnail", detail: "node_type: image · prompt seeded" });
        const thumbNodeId = await melius.createImageNode(canvasId, "Video Thumbnail", thumbPrompt, pos("thumbnail"));
        sendNode({ id: thumbNodeId, label: "Video Thumbnail", type: "image", status: "pending", prompt: thumbPrompt, reasoning: "Generating a clean, inviting thumbnail prompt." });

        // Hook Concept
        const hookConceptText = [
          hookChoice.concept,
          "",
          `Archetype: ${hookChoice.archetype.label}`,
          `Reasoning: ${hookChoice.reasoning}`,
          `Format: ${hookFormat.label}`,
          `Model: ${hookAccess.modelLabel}`,
        ].filter(Boolean).join("\n");

        send({ phase: "nodes", status: "Placing Hook Concept", detail: "node_type: custom_text · archetype reasoning" });
        const hookConceptNodeId = await melius.createCustomTextNode(canvasId, "Hook Concept", hookConceptText, pos("hookConcept"));
        sendNode({ id: hookConceptNodeId, label: "Hook Concept", type: "custom_text", status: "complete", prompt: hookConceptText, reasoning: "Documenting strategy." });

        // Video Node - created as "generating" placeholder first
        send({ phase: "nodes", status: "Placing Hook Cinematic", detail: "node_type: video · fal hook prompt" });
        let hookVideoNodeId: string | null = null;
        try {
          hookVideoNodeId = await melius.createVideoNode(canvasId, "Hook Cinematic", hookChoice.prompt, pos("hookVideo"), undefined);
          sendNode({
            id: hookVideoNodeId, label: "Hook Cinematic", type: "video",
            status: "generating",
            prompt: hookChoice.prompt, outputUrl: undefined, reasoning: "Placing cinematic video hook."
          });
        } catch (error) {
          console.warn("[studio/build] Hook video node failed", error);
        }

        // Edges
        send({ phase: "edges", status: "Wiring Profile → Background", detail: "edge_type: text" });
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

        send({ phase: "canvas", status: "Grouping nodes into one workspace", detail: "Single draggable workspace" });
        const allNodeIds = [profileNodeId, scriptNodeId, visualDirNodeId, objectiveNodeId, bgNodeId, thumbNodeId, hookConceptNodeId, hookVideoNodeId].filter(Boolean) as string[];
        await melius.createGroupNode(canvasId, `${profile.name} — Video Outreach`, allNodeIds);

        send({ phase: "canvas", status: "Leaving an audit comment", detail: "Future humans will know an agent did this" });
        await melius.addComment(canvasId, `nuncio studio session for ${profile.name}. Hook Engine chose ${hookChoice.archetype.label}`, 0, -80);

        await melius.releasePresence(canvasId);

        // Start Runs
        send({ phase: "generate", status: "Kicking off background image", detail: "Model: Seedance · poll for completion" });
        await melius.startRun(bgNodeId, canvasId);
        send({ phase: "generate", status: "Kicking off thumbnail image", detail: "Model: Seedance · poll for completion" });
        await melius.startRun(thumbNodeId, canvasId);

        // Final result (video node in generating state initially)
        const finalResult: StudioBuildResult = {
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
            status: "generating",
            format: hookFormat.label,
            formatReasoning: hookFormat.reasoning,
            outputUrl: undefined,
            warning: hookAccess.reason,
          },
        };

        // Trigger background video generation asynchronously (non-blocking)
        if (hookVideoNodeId) {
          (async () => {
            try {
              console.log(`[studio/build] Starting background hook video generation for canvas ${canvasId}...`);
              const hookGeneration = await generateHookVideo({
                prompt: hookChoice.prompt,
                modelEndpoint: hookAccess.modelEndpoint,
                tier: hookAccess.tier,
                generationAllowed: hookAccess.generationAllowed,
                aspectRatio: hookFormat.aspectRatio,
                durationSeconds: Math.min(5, hookFormat.durationSeconds),
              });

              if (hookGeneration.outputUrl) {
                console.log(`[studio/build] Background video generation complete! Attaching to node ${hookVideoNodeId} on canvas ${canvasId}...`);
                await melius.attachVideoToNode(hookVideoNodeId, hookGeneration.outputUrl, canvasId);
              } else {
                console.error(`[studio/build] Background video generation completed but returned no outputUrl for canvas ${canvasId}:`, hookGeneration);
              }
            } catch (err) {
              console.error(`[studio/build] Background video generation failed for canvas ${canvasId}:`, err);
            }
          })();
        }

        send({ type: "done", result: finalResult });
        controller.close();
      } catch (error) {
        console.error("[studio/build] Stream error:", error);
        send({ error: error instanceof Error ? error.message : "Studio build failed" });
        controller.close();
      }
    }
  });

  const response = new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });

  ensureTrialCookie(response, request);
  return response;
}
