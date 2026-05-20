import { NextRequest, NextResponse } from "next/server";
import { enrich } from "@/lib/tinyfish";
import { synthesise, generateScript } from "@/lib/claude";
import type { Profile, IntentId } from "@/lib/claude";
import { chooseArchetype } from "@/lib/hooks/select";
import { pickFormat, type HookArchetypeId } from "@/lib/hooks/archetypes";

export interface EnrichResponse {
  profile: Profile;
  script: string;
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

  const script = await generateScript(profile, senderBrief, {
    intent: intent as IntentId | undefined,
    senderName: typeof senderName === "string" ? senderName.trim() || undefined : undefined,
  });

  const hookChoice = chooseArchetype(profile, senderBrief, archetype as HookArchetypeId | undefined);
  const hookFormat = pickFormat(profile);

  const response: EnrichResponse = {
    profile,
    script,
    hook: {
      archetype: hookChoice.archetype.label,
      reasoning: hookChoice.reasoning,
      concept: hookChoice.concept,
      prompt: hookChoice.prompt,
      format: hookFormat.label,
      formatReasoning: hookFormat.reasoning,
    },
  };

  return NextResponse.json(response);
}
