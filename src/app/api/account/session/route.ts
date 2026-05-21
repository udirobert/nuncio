import { NextRequest, NextResponse } from "next/server";
import { accountCookieOptions, ACCOUNT_COOKIE, createAccountSessionCookie, readAccountSession } from "@/lib/auth/session";
import { ensureTrialCredits, upsertBillingAccount } from "@/lib/billing/accounts";
import { getCreditBalance } from "@/lib/billing/credits";
import { getAccountStorageProvider } from "@/lib/storage";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: NextRequest) {
  const session = readAccountSession(request);
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  const summary = await getAccountStorageProvider().getCreditSummary(session.workspaceId);
  return NextResponse.json({
    authenticated: true,
    userId: session.userId,
    workspaceId: session.workspaceId,
    email: session.email,
    plan: summary?.workspace.plan || "free",
    balance: await getCreditBalance({
      workspaceId: session.workspaceId,
      userId: session.userId,
      anonymous: false,
    }),
  });
}

export async function POST(request: NextRequest) {
  const { email } = await request.json();
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!EMAIL_RE.test(normalizedEmail)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const { user, workspace } = await upsertBillingAccount({
    email: normalizedEmail,
    planType: "free",
  });
  await ensureTrialCredits({ user, workspace });

  const response = NextResponse.json({
    authenticated: true,
    userId: user.id,
    workspaceId: workspace.id,
    email: user.email,
    plan: workspace.plan || "free",
    balance: await getCreditBalance({
      workspaceId: workspace.id,
      userId: user.id,
      anonymous: false,
    }),
  });
  response.cookies.set(ACCOUNT_COOKIE, createAccountSessionCookie({ user, workspace }), accountCookieOptions());
  return response;
}
