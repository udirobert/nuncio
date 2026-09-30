import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLinkToken } from "@/lib/auth/magic-link";
import { accountCookieOptions, ACCOUNT_COOKIE, createAccountSessionCookie } from "@/lib/auth/session";
import { ensureTrialCredits, upsertBillingAccount } from "@/lib/billing/accounts";
import { absoluteUrl } from "@/lib/url";
import { resolveLoginNext } from "@/lib/auth/login-next";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const next = resolveLoginNext(request.nextUrl.searchParams.get("next"));

  const loginUrl = (error: string) =>
    absoluteUrl(`/login?${new URLSearchParams({ error, next })}`, request);

  if (!token) {
    return NextResponse.redirect(loginUrl("missing_token"), { status: 302 });
  }

  const email = await verifyMagicLinkToken(token);
  if (!email) {
    return NextResponse.redirect(loginUrl("invalid_or_expired"), { status: 302 });
  }

  const { user, workspace } = await upsertBillingAccount({ email, planType: "free" });
  await ensureTrialCredits({ user, workspace });

  const response = NextResponse.redirect(absoluteUrl(next, request));
  response.cookies.set(ACCOUNT_COOKIE, createAccountSessionCookie({ user, workspace }), accountCookieOptions());
  return response;
}
