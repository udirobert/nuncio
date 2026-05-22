import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    message: "Sentry is configured. Set SENTRY_DSN in env to enable error reporting.",
  });
}
