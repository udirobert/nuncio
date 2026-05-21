import { NextRequest, NextResponse } from "next/server";
import { enrich } from "@/lib/tinyfish";
import { synthesise, generateScript } from "@/lib/claude";
import type { Profile, IntentId } from "@/lib/claude";
import { chooseArchetype } from "@/lib/hooks/select";
import { pickFormat, type HookArchetypeId } from "@/lib/hooks/archetypes";
import {
  commitCreditReservation,
  estimateCreditCost,
  getCreditBalance,
  getCreditSubject,
  InsufficientCreditsError,
  refundCreditReservation,
  reserveCredits,
} from "@/lib/billing/credits";

export interface EnrichResponse {
  profile: Profile;
  script: string;
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
  const body = await request.json();
  const { url, senderBrief, senderName, intent, archetype } = body;
  const clientProfile = body.profile as Profile | undefined;

  const subject = getCreditSubject(request);
  const researchCost = estimateCreditCost("profile.research");
  const scriptCost = estimateCreditCost("script.generate");
  const totalCost = researchCost + scriptCost;
  let reservationId: string | undefined;

  try {
    const reservation = await reserveCredits({
      subject,
      action: "script.generate",
      amount: totalCost,
      reason: "Research profile and generate script (studio)",
      provider: clientProfile ? "llm" : "tinyfish+llm",
    });
    reservationId = reservation.id;

    let profile: Profile;

    if (clientProfile) {
      profile = clientProfile;
    } else {
      if (!url) {
        return NextResponse.json({ error: "url is required" }, { status: 400 });
      }

      const enrichment = await enrich([url], { discoverRelated: true });
      const markdown = enrichment.filter((r) => r.success).map((r) => r.markdown);

      if (markdown.length === 0) {
        return NextResponse.json(
          { error: "Could not access profile. The page may be behind a login wall — try a different URL or platform." },
          { status: 422 }
        );
      }

      profile = await synthesise(markdown);

      if (profile.name === "there") {
        return NextResponse.json(
          { error: "Could not identify a person from this profile. Try a different URL or platform." },
          { status: 422 }
        );
      }
    }

    const scriptResult = await generateScript(profile, senderBrief, {
      intent: intent as IntentId | undefined,
      senderName: typeof senderName === "string" ? senderName.trim() || undefined : undefined,
    });

    const hookChoice = chooseArchetype(profile, senderBrief, archetype as HookArchetypeId | undefined);
    const hookFormat = pickFormat(profile);

    await commitCreditReservation(reservation.id);

    const response: EnrichResponse = {
      profile,
      script: scriptResult.script,
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

    return NextResponse.json(response, {
      headers: {
        "X-Nuncio-Credits-Charged": String(totalCost),
        "X-Nuncio-Credits-Balance": String(await getCreditBalance(subject)),
      },
    });
  } catch (error) {
    if (reservationId) {
      await refundCreditReservation(reservationId);
    }

    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: error.message,
          requiredCredits: error.required,
          availableCredits: error.available,
        },
        { status: 402 }
      );
    }

    throw error;
  }
}
