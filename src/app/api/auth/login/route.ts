import { NextRequest, NextResponse } from "next/server";
import { createMagicLinkToken } from "@/lib/auth/magic-link";
import { sendMagicLinkEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const { email } = await request.json();
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!EMAIL_RE.test(normalized)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const token = await createMagicLinkToken(normalized);
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const link = `${appUrl}/api/auth/verify?token=${token}`;

  sendMagicLinkEmail(normalized, link);

  return NextResponse.json({
    ok: true,
    email: normalized,
    sent: true,
    ...(process.env.NODE_ENV === "development" || !process.env.RESEND_API_KEY
      ? { devLink: link }
      : {}),
  });
}
