import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLinkToken } from "@/lib/auth/magic-link";
import { accountCookieOptions, ACCOUNT_COOKIE, createAccountSessionCookie } from "@/lib/auth/session";
import { ensureTrialCredits, upsertBillingAccount } from "@/lib/billing/accounts";
import { absoluteUrl } from "@/lib/url";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(absoluteUrl("/login?error=missing_token", request), { status: 302 });
  }

  const email = await verifyMagicLinkToken(token);
  if (!email) {
    return NextResponse.redirect(absoluteUrl("/login?error=invalid_or_expired", request), { status: 302 });
  }

  const { user, workspace } = await upsertBillingAccount({ email, planType: "free" });
  await ensureTrialCredits({ user, workspace });

  const response = NextResponse.redirect(absoluteUrl("/studio", request));
  response.cookies.set(ACCOUNT_COOKIE, createAccountSessionCookie({ user, workspace }), accountCookieOptions());
  return response;
}
