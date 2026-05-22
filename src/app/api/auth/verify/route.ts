import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLinkToken } from "@/lib/auth/magic-link";
import { accountCookieOptions, ACCOUNT_COOKIE, createAccountSessionCookie } from "@/lib/auth/session";
import { ensureTrialCredits, upsertBillingAccount } from "@/lib/billing/accounts";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", request.url));
  }

  const email = await verifyMagicLinkToken(token);
  if (!email) {
    return NextResponse.redirect(new URL("/login?error=invalid_or_expired", request.url));
  }

  const { user, workspace } = await upsertBillingAccount({ email, planType: "free" });
  await ensureTrialCredits({ user, workspace });

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(ACCOUNT_COOKIE, createAccountSessionCookie({ user, workspace }), accountCookieOptions());
  return response;
}
