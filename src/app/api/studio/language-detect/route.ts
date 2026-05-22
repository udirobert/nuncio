import { NextRequest, NextResponse } from "next/server";
import { detectLanguageFromUrl } from "@/lib/language-detect";

export async function POST(request: NextRequest) {
  const { url } = await request.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const language = await detectLanguageFromUrl(url);
    return NextResponse.json({ language });
  } catch {
    return NextResponse.json({ language: null });
  }
}
