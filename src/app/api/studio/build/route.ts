import { NextRequest } from "next/server";
import { enrich, fetchRecentActivity, enrichCompany } from "@/lib/tinyfish";
import { synthesise, generateScript } from "@/lib/claude";
import { MeliusProvider, resetMeliusSession } from "@/lib/creative/melius-provider";
import type { StudioNode, StudioBuildResult } from "@/lib/creative/melius-provider";
import { chooseArchetype } from "@/lib/hooks/select";
import { ensureTrialCookie, resolveHookAccess } from "@/lib/hooks/tiers";
import { pickFormat, type HookArchetypeId } from "@/lib/hooks/archetypes";
import { generateAmbientVibe } from "@/lib/elevenlabs";
import {
  commitCreditReservation,
  estimateCreditCost,
  getCreditSubject,
  InsufficientCreditsError,
  refundCreditReservation,
  reserveCredits,
} from "@/lib/billing/credits";

const NODE_DIMENSIONS = {
  text: { w: 420, h: 140 },
  textLarge: { w: 420, h: 200 },
  image: { w: 420, h: 236 },
  video: { w: 420, h: 236 },
};

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let reservationId: string | undefined;
      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      try {
        const body = await request.json();
        const { url, senderBrief, senderName, intent, email, archetype, meliusApiKey } = body;

        // Confirmed mode: profile + script already reviewed by user
        const confirmedProfile = body.profile as import("@/lib/claude").Profile | undefined;
        const confirmedScript = body.script as string | undefined;
        const confirmedHook = body.hook as { archetype: string; reasoning: string; concept: string; prompt: string; format: string; formatReasoning: string } | undefined;
        if (!(confirmedProfile && confirmedScript) && !url) {
          send({ error: "url is required" });
          controller.close();
          return;
        }
        const subject = getCreditSubject(request);
        const creditCost = confirmedProfile && confirmedScript
          ? estimateCreditCost("canvas.build")
          : estimateCreditCost("profile.research") + estimateCreditCost("script.generate") + estimateCreditCost("canvas.build");
        const reservation = await reserveCredits({
          subject,
          action: "canvas.build",
          amount: creditCost,
          reason: confirmedProfile && confirmedScript ? "Build Studio canvas from reviewed script" : "Build Studio campaign from URL",
          provider: "melius",
        });
        reservationId = reservation.id;

        let profile: import("@/lib/claude").Profile;
        let script: string;
        let hookChoice: { archetype: { label: string }; reasoning: string; concept: string; prompt: string };
        let hookFormat: { label: string; reasoning: string };
        let scriptResult: import("@/lib/claude").ScriptResult | null = null;

        if (confirmedProfile && confirmedScript) {
          // Skip enrichment — user already reviewed and confirmed
          profile = confirmedProfile;
          script = confirmedScript;
          if (confirmedHook) {
            hookChoice = { archetype: { label: confirmedHook.archetype }, reasoning: confirmedHook.reasoning, concept: confirmedHook.concept, prompt: confirmedHook.prompt };
            hookFormat = { label: confirmedHook.format, reasoning: confirmedHook.formatReasoning };
          } else {
            const hc = chooseArchetype(profile, senderBrief, archetype as HookArchetypeId | undefined);
            hookChoice = { archetype: { label: hc.archetype.label }, reasoning: hc.reasoning, concept: hc.concept, prompt: hc.prompt };
            const hf = pickFormat(profile);
            hookFormat = { label: hf.label, reasoning: hf.reasoning };
          }
          send({ phase: "synthesise", status: "Using confirmed profile", detail: `${profile.name} — ${profile.current_role}` });
        } else {
          // Legacy mode: full pipeline from URL
          if (!url) {
            send({ error: "url is required" });
            controller.close();
            return;
          }

          // 1. Enrich
          send({ phase: "enrich", status: "Reading public profile...", detail: "Fetching markdown + discovering related URLs" });
          const enrichment = await enrich([url], { discoverRelated: true });
          const markdown = enrichment.filter((r) => r.success).map((r) => r.markdown);
          if (markdown.length === 0) {
            send({ error: "Could not access profile" });
            controller.close();
            return;
          }

          // 2. Synthesise
          send({ phase: "synthesise", status: "Parsing surface signals...", detail: "Role · company · notable work · interests · tone" });
          profile = await synthesise(markdown);

          if (profile.name === "there") {
            send({ error: "Could not identify a person from this profile. The page may be behind a login wall — try a different URL or platform." });
            controller.close();
            return;
          }

          // 2.5 Recent activity enrichment
          let recentActivity: string | undefined;
          let companyContext: string | undefined;
          if (url) {
            send({ phase: "enrich", status: "Fetching recent activity...", detail: "Recent posts and mentions" });
            const activity = await fetchRecentActivity(url);
            if (activity) recentActivity = activity.markdown;
          }
          if (profile.company && profile.company !== "there") {
            send({ phase: "enrich", status: "Gathering company context...", detail: profile.company });
            const ctx = await enrichCompany(profile.company);
            if (ctx) companyContext = ctx;
          }

          // 3. Generate script
          send({ phase: "synthesise", status: "Drafting outreach script...", detail: "Conversational, < 90 seconds, specific" });
          scriptResult = await generateScript(profile, senderBrief, {
            intent: intent as Parameters<typeof generateScript>[2] extends { intent: infer I } ? I : undefined,
            senderName: typeof senderName === "string" ? senderName.trim() || undefined : undefined,
            recentActivity,
            companyContext,
          });
          script = scriptResult.script;
          // Store the vibeId in the session or send it as part of the phase metadata
          send({ phase: "synthesise", status: "Recommending Cinematic Vibe...", detail: scriptResult.vibeReasoning });
          
          const hc = chooseArchetype(profile, senderBrief, archetype as HookArchetypeId | undefined);
          hookChoice = { archetype: { label: hc.archetype.label }, reasoning: hc.reasoning, concept: hc.concept, prompt: hc.prompt };
          const hf = pickFormat(profile);
          hookFormat = { label: hf.label, reasoning: hf.reasoning };
        }

        const hookAccess = resolveHookAccess(request, typeof email === "string" ? email : null);

        // 4. Build Melius canvas
        resetMeliusSession();
        const melius = new MeliusProvider(meliusApiKey || undefined);

        send({ phase: "canvas", status: "Initialising Melius session...", detail: "MCP session initialised" });
        const session = await melius.createSession(profile.name);
        const canvasId = session.id;
        const projectId = melius["projectId"] || "";

        if (!canvasId) {
          throw new Error("Failed to create Melius canvas");
        }

        const canvasUrl = session.canvasUrl || `https://app.melius.com/canvas/${canvasId}`;

        send({
          phase: "canvas",
          status: "Opening a fresh Melius canvas",
          detail: `Canvas created: ${canvasId}`,
          canvas: { projectId, canvasId, canvasUrl },
        });

        await melius.claimPresence(canvasId, { x: 0, y: 0, w: 880, h: 600 });

        const role = profile.current_role ? `${profile.current_role}${profile.company ? ` at ${profile.company}` : ""}` : "a professional";
        const bgPrompt = `Professional video background for a personalised outreach to ${profile.name}${profile.company ? ` at ${profile.company}` : ""}. Clean, warm, ${profile.tone} tone. No text, no faces. 16:9.`;
        const thumbPrompt = `Video thumbnail for a personalised message to ${profile.name}. Professional, clean, inviting. 16:9.`;
        const objectiveText = senderBrief || `Personalised video outreach to ${profile.name}`;
        const visualDirection = `Tone: ${profile.tone}, warm, genuine\nStyle: Clean, professional background. Warm lighting.\nTarget: ${profile.name} — ${role}`;
        const profileSummary = `${profile.name} — ${profile.current_role}${profile.company ? ` at ${profile.company}` : ""}\n\nNotable: ${profile.notable_work.join(", ")}\nInterests: ${profile.interests.join(", ")}`;

        // Let Melius compute optimal layout — we only provide dimensions
        const layoutSpec = [
          { id: crypto.randomUUID(), nodeType: "custom_text", ...NODE_DIMENSIONS.text },
          { id: crypto.randomUUID(), nodeType: "custom_text", ...NODE_DIMENSIONS.textLarge },
          { id: crypto.randomUUID(), nodeType: "custom_text", ...NODE_DIMENSIONS.text },
          { id: crypto.randomUUID(), nodeType: "custom_text", ...NODE_DIMENSIONS.text },
          { id: crypto.randomUUID(), nodeType: "image", ...NODE_DIMENSIONS.image },
          { id: crypto.randomUUID(), nodeType: "image", ...NODE_DIMENSIONS.image },
          { id: crypto.randomUUID(), nodeType: "custom_text", ...NODE_DIMENSIONS.text },
          { id: crypto.randomUUID(), nodeType: "video", ...NODE_DIMENSIONS.video },
        ];

        send({ phase: "canvas", status: "Planning node layout", detail: "8 nodes · dynamic positions" });
        let positions: { x: number; y: number }[] = [];
        try {
          positions = await melius.planLayout(canvasId, layoutSpec);
        } catch (error) {
          console.warn("[studio/build] Layout planning failed, using fallback:", error);
        }

        // Fallback positions if planLayout fails
        const fallbackPositions = [
          { x: 0, y: 0 }, { x: 0, y: 160 }, { x: 0, y: 380 }, { x: 0, y: 540 },
          { x: 460, y: 0 }, { x: 460, y: 256 },
          { x: 920, y: 0 }, { x: 920, y: 180 },
        ];

        function geo(idx: number): { x: number; y: number; w: number; h: number } {
          const p = positions[idx] || fallbackPositions[idx] || { x: idx * 100, y: 0 };
          const spec = layoutSpec[idx];
          return { x: p.x, y: p.y, w: spec.w, h: spec.h };
        }

        const studioNodes: StudioNode[] = [];
        const sendNode = (node: StudioNode) => {
          studioNodes.push(node);
          send({ phase: "nodes", node });
        };

        // Text nodes
        send({ phase: "nodes", status: "Placing Profile Summary", detail: "node_type: custom_text" });
        const profileNodeId = await melius.createCustomTextNode(canvasId, "Profile Summary", profileSummary, geo(0));
        sendNode({ id: profileNodeId, label: "Profile Summary", type: "custom_text", status: "complete", prompt: profileSummary });

        send({ phase: "nodes", status: "Placing Script", detail: "node_type: custom_text" });
        const scriptNodeId = await melius.createCustomTextNode(canvasId, "Script", script, geo(1));
        sendNode({ id: scriptNodeId, label: "Script", type: "custom_text", status: "complete", prompt: script });

        send({ phase: "nodes", status: "Placing Visual Direction", detail: "node_type: custom_text" });
        const visualDirNodeId = await melius.createCustomTextNode(canvasId, "Visual Direction", visualDirection, geo(2));
        sendNode({ id: visualDirNodeId, label: "Visual Direction", type: "custom_text", status: "complete", prompt: visualDirection });

        send({ phase: "nodes", status: "Placing Outreach Objective", detail: "node_type: custom_text" });
        const objectiveNodeId = await melius.createCustomTextNode(canvasId, "Outreach Objective", objectiveText, geo(3));
        sendNode({ id: objectiveNodeId, label: "Outreach Objective", type: "custom_text", status: "complete", prompt: objectiveText });

        // Image nodes
        send({ phase: "nodes", status: "Placing Video Background", detail: "node_type: image · prompt seeded" });
        const bgNodeId = await melius.createImageNode(canvasId, "Video Background", bgPrompt, geo(4));
        sendNode({ id: bgNodeId, label: "Video Background", type: "image", status: "pending", prompt: bgPrompt });

        send({ phase: "nodes", status: "Placing Video Thumbnail", detail: "node_type: image · prompt seeded" });
        const thumbNodeId = await melius.createImageNode(canvasId, "Video Thumbnail", thumbPrompt, geo(5));
        sendNode({ id: thumbNodeId, label: "Video Thumbnail", type: "image", status: "pending", prompt: thumbPrompt });

        // Hook Concept
        const hookConceptText = [
          hookChoice.concept,
          "",
          `Archetype: ${hookChoice.archetype.label}`,
          `Reasoning: ${hookChoice.reasoning}`,
          `Format: ${hookFormat.label}`,
        ].filter(Boolean).join("\n");

        send({ phase: "nodes", status: "Placing Hook Concept", detail: "node_type: custom_text · archetype reasoning" });
        const hookConceptNodeId = await melius.createCustomTextNode(canvasId, "Hook Concept", hookConceptText, geo(6));
        sendNode({ id: hookConceptNodeId, label: "Hook Concept", type: "custom_text", status: "complete", prompt: hookConceptText });

        // Video Node — generation happens through Melius (not Fal directly)
        send({ phase: "nodes", status: "Placing Hook Cinematic", detail: "node_type: video · Melius generation" });
        let hookVideoNodeId: string | null = null;
        try {
          hookVideoNodeId = await melius.createVideoNode(canvasId, "Hook Cinematic", hookChoice.prompt, geo(7), undefined);
          sendNode({
            id: hookVideoNodeId, label: "Hook Cinematic", type: "video",
            status: "pending", prompt: hookChoice.prompt,
          });
        } catch (error) {
          console.warn("[studio/build] Hook video node creation failed:", error);
        }

        // Edges
        send({ phase: "edges", status: "Wiring node connections", detail: "Context flows between nodes" });
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

        send({ phase: "canvas", status: "Grouping nodes", detail: "Single workspace" });
        const allNodeIds = [profileNodeId, scriptNodeId, visualDirNodeId, objectiveNodeId, bgNodeId, thumbNodeId, hookConceptNodeId, hookVideoNodeId].filter(Boolean) as string[];
        await melius.createGroupNode(canvasId, `${profile.name} — Video Outreach`, allNodeIds);

        send({ phase: "canvas", status: "Leaving an audit comment" });
        await melius.addComment(canvasId, `nuncio studio session for ${profile.name}. Hook: ${hookChoice.archetype.label}`, 0, -80);

        await melius.releasePresence(canvasId);

        // Start generation runs — client-side polling picks up output URLs
        send({ phase: "generate", status: "Starting image generation", detail: "Background + Thumbnail via Melius" });
        await melius.startRun(bgNodeId, canvasId);
        await melius.startRun(thumbNodeId, canvasId);

        if (hookVideoNodeId && hookAccess.generationAllowed) {
          send({ phase: "generate", status: "Starting hook video generation", detail: "Via Melius video node" });
          await melius.startRun(hookVideoNodeId, canvasId);
        }

        send({ phase: "generate", status: "Generation started", detail: "Assets rendering — polling for completion" });

        // Generate cinematic soundscape (non-blocking — don't fail the build if ElevenLabs is unavailable)
        let soundscapeDataUrl: string | undefined;
        const vibeId = scriptResult?.vibeId || body.vibeId || "tech-office";
        try {
          if (process.env.ELEVENLABS_API_KEY) {
            send({ phase: "generate", status: "Generating cinematic soundscape", detail: `ElevenLabs · vibe: ${vibeId}` });
            const audioBuffer = await generateAmbientVibe(vibeId);
            soundscapeDataUrl = `data:audio/mpeg;base64,${audioBuffer.toString("base64")}`;
          }
        } catch (error) {
          console.warn("[studio/build] Soundscape generation failed (non-fatal):", error);
        }

        const finalResult: StudioBuildResult = {
          projectId,
          canvasId,
          canvasUrl,
          userOwned: !!meliusApiKey,
          nodes: studioNodes,
          recommendedVibeId: scriptResult?.vibeId || "tech-office",
          vibeReasoning: scriptResult?.vibeReasoning || "Standard professional vibe.",
          soundscapeUrl: soundscapeDataUrl,
          hook: {
            archetype: hookChoice.archetype.label,
            reasoning: hookChoice.reasoning,
            tier: hookAccess.tier,
            remainingFree: hookAccess.remainingFree,
            canRegenerate: hookAccess.canRegenerate,
            watermark: hookAccess.watermark,
            status: hookAccess.generationAllowed ? "generating" : "demo",
            format: hookFormat.label,
            formatReasoning: hookFormat.reasoning,
            outputUrl: undefined,
            warning: hookAccess.reason,
          },
        };

        await commitCreditReservation(reservation.id);
        send({ type: "done", result: finalResult });
        controller.close();
      } catch (error) {
        if (reservationId) {
          await refundCreditReservation(reservationId);
        }
        console.error("[studio/build] Stream error:", error);
        if (error instanceof InsufficientCreditsError) {
          send({
            error: error.message,
            requiredCredits: error.required,
            availableCredits: error.available,
          });
        } else {
          send({ error: error instanceof Error ? error.message : "Studio build failed" });
        }
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
