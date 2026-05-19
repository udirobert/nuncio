import { NextResponse } from "next/server";
import { getVoices } from "@/lib/heygen";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const voices = await getVoices();
    return NextResponse.json({ voices });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch voices" },
      { status: 500 }
    );
  }
}
