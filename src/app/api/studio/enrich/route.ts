import { NextRequest } from "next/server";
import { enrich, fetchRecentActivity, enrichCompany } from "@/lib/tinyfish";
import { synthesise, generateScript, generateScriptVariants } from "@/lib/claude";
import type { Profile, IntentId, ScriptResult } from "@/lib/claude";
import { chooseArchetype } from "@/lib/hooks/select";
import { pickFormat, type HookArchetypeId } from "@/lib/hooks/archetypes";
import {
  commitCreditReservation,
  estimateCreditCost,
  getCreditBalance,
  getCreditSubject,
  InsufficientCreditsError,
  reserveCredits,
} from "@/lib/billing/credits";

export interface EnrichResponse {
  profile: Profile;
  script: string;
  scriptVariantA?: string;
  scriptVariantB?: string;
  vibeId: string;
  vibeReasoning: string;
  hook: {
    archetype: string;
    reasoning: string;
    concept: string;
    prompt: string;
    format: string;
    formatReasoning: string;
  };
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
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
        const { url, senderBrief, senderName, intent, archetype } = body;
        const clientProfile = body.profile as Profile | undefined;
        const languageOverride = body.language as string | undefined;

        const subject = getCreditSubject(request);
        const researchCost = estimateCreditCost("profile.research");
        const scriptCost = estimateCreditCost("script.generate");
        const totalCost = researchCost + scriptCost;

        const reservation = await reserveCredits({
          subject,
          action: "script.generate",
          amount: totalCost,
          reason: "Research profile and generate script (studio)",
          provider: clientProfile ? "llm" : "tinyfish+llm",
        });

        let profile: Profile;

        if (clientProfile) {
          profile = clientProfile;
          if (languageOverride) {
            profile.language = languageOverride;
          }
        } else {
          if (!url) {
            send({ error: "url is required" });
            controller.close();
            return;
          }

          send({ phase: "enrich" });

          const enrichment_0 = await enrich([url], { discoverRelated: true });
          const markdown = enrichment_0.filter((r) => r.success).map((r) => r.markdown);

          if (markdown.length === 0) {
            send({ error: "Could not access profile. The page may be behind a login wall — try a different URL or platform." });
            controller.close();
            return;
          }

          send({ phase: "synthesise" });

          profile = await synthesise(markdown);

          if (profile.name === "there") {
            send({ error: "Could not identify a person from this profile. Try a different URL or platform." });
            controller.close();
            return;
          }
        }

        if (languageOverride) {
          profile.language = languageOverride;
        }

        send({ phase: "compose" });

        let recentActivity: string | undefined;
        let companyContext: string | undefined;

        if (url) {
          const activity = await fetchRecentActivity(url);
          if (activity) recentActivity = activity.markdown;
        }

        if (profile.company && profile.company !== "there") {
          const ctx = await enrichCompany(profile.company);
          if (ctx) companyContext = ctx;
        }

        const scriptOptions = {
          intent: intent as IntentId | undefined,
          senderName: typeof senderName === "string" ? senderName.trim() || undefined : undefined,
          recentActivity,
          companyContext,
        };

        let scriptResult: ScriptResult;
        let variantA: string | undefined;
        let variantB: string | undefined;

        const wantsVariants = body.scriptVariants === true;
        if (wantsVariants) {
          const variants = await generateScriptVariants(profile, senderBrief, scriptOptions);
          scriptResult = variants.variantA;
          variantA = variants.variantA.script;
          variantB = variants.variantB.script;
        } else {
          scriptResult = await generateScript(profile, senderBrief, scriptOptions);
        }

        const hookChoice = chooseArchetype(profile, senderBrief, archetype as HookArchetypeId | undefined);
        const hookFormat = pickFormat(profile);

        await commitCreditReservation(reservation.id);

        const response: EnrichResponse = {
          profile,
          script: scriptResult.script,
          scriptVariantA: variantA,
          scriptVariantB: variantB,
          vibeId: scriptResult.vibeId,
          vibeReasoning: scriptResult.vibeReasoning,
          hook: {
            archetype: hookChoice.archetype.label,
            reasoning: hookChoice.reasoning,
            concept: hookChoice.concept,
            prompt: hookChoice.prompt,
            format: hookFormat.label,
            formatReasoning: hookFormat.reasoning,
          },
        };

        send({
          type: "done",
          result: response,
          creditsCharged: totalCost,
          creditsBalance: await getCreditBalance(subject),
        });

        controller.close();
      } catch (error) {
        if (error instanceof InsufficientCreditsError) {
          send({
            error: error.message,
            requiredCredits: error.required,
            availableCredits: error.available,
            insufficientCredits: true,
          });
        } else {
          console.error("[enrich] Fatal:", error);
          send({ error: "Something went wrong during enrichment" });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
