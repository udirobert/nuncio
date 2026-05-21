import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createMagicLinkToken } from "@/lib/auth/magic-link";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sendEmail(email: string, link: string): void {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.log(`[auth] No RESEND_API_KEY configured. Magic link for ${email}: ${link}`);
    return;
  }

  const resend = new Resend(resendKey);
  resend.emails.send({
    from: process.env.RESEND_FROM || "nuncio <login@nuncio.persidian.com>",
    to: email,
    subject: "Sign in to nuncio",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 20px">
      <h1 style="font-size:24px;font-weight:400;margin:0 0 8px">nuncio</h1>
      <p style="color:#666;font-size:15px;line-height:1.5">Click the link below to sign in. This link expires in 15 minutes.</p>
      <a href="${link}" style="display:inline-block;margin:24px 0;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:8px;font-size:14px">Sign in to nuncio</a>
      <p style="color:#999;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
    </div>`,
  }).then(() => {
    console.log(`[auth] Magic link sent to ${email}`);
  }).catch((err) => {
    console.error(`[auth] Failed to send email to ${email}:`, err);
  });
}

export async function POST(request: NextRequest) {
  const { email } = await request.json();
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!EMAIL_RE.test(normalized)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const token = createMagicLinkToken(normalized);
  const link = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/verify?token=${token}`;

  sendEmail(normalized, link);

  return NextResponse.json({
    ok: true,
    email: normalized,
    sent: true,
    ...(process.env.NODE_ENV === "development" || !process.env.RESEND_API_KEY
      ? { devLink: link }
      : {}),
  });
}
