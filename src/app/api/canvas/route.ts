import { NextRequest, NextResponse } from "next/server";
import { createCanvas } from "@/lib/melius";

function detectIndustry(profile?: { current_role?: string; company?: string; interests?: string[]; notable_work?: string[] }): string {
  if (!profile) return "general";

  const text = [
    profile.current_role || "",
    profile.company || "",
    ...(profile.interests || []),
    ...(profile.notable_work || []),
  ]
    .join(" ")
    .toLowerCase();

  const patterns: [string, RegExp][] = [
    ["food", /food|restaurant|chef|catering|bakery|culinary|menu|dining|foodtech|meal/],
    ["fitness", /fitness|gym|personal trainer|athlete|sports|wellness|health|training|movement|performance/],
    ["construction", /construction|builder|landscape|contractor|renovation|architecture|design|real estate|property|develop/],
    ["tech", /software|developer|engineer|ai|ml|data|startup|tech|saas|product|engineering|cto|vp engineering/],
    ["finance", /finance|bank|investment|accounting|fintech|wealth|cfo|controller|financial/],
    ["healthcare", /doctor|medical|health|nurse|hospital|pharma|biotech|clinical|healthcare|therapist/],
    ["education", /teacher|professor|school|university|education|training|learning|coach|mentor/],
    ["marketing", /marketing|brand|content|social media|creative|agency|growth|seo|communications|pr/],
    ["sales", /sales|business development|account executive|revenue|partnerships|bd|saas sales|account manager/],
  ];

  for (const [industry, regex] of patterns) {
    if (regex.test(text)) return industry;
  }

  return "general";
}

export async function POST(request: NextRequest) {
  try {
    const { profile, script, senderBrief } = await request.json();

    if (!profile || !script) {
      return NextResponse.json(
        { error: "Profile and script are required" },
        { status: 400 }
      );
    }

    const industry = detectIndustry(profile);
    const result = await createCanvas(profile, script, senderBrief, industry);
    return NextResponse.json({ ...result, industry });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Canvas creation failed" },
      { status: 500 }
    );
  }
}
