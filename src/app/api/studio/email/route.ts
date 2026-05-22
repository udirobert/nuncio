import { NextRequest, NextResponse } from "next/server";
import { createShareRecord } from "@/lib/share-store";
import type { StudioBuildResult } from "@/lib/creative/melius-provider";
import { accountCookieOptions, ACCOUNT_COOKIE, createAccountSessionCookie } from "@/lib/auth/session";
import { ensureTrialCredits, upsertBillingAccount } from "@/lib/billing/accounts";
import { getCreditBalance } from "@/lib/billing/credits";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      honeypot,
      buildResult,
    }: {
      email?: string;
      honeypot?: string;
      buildResult?: Pick<StudioBuildResult, "canvasId" | "canvasUrl" | "projectId" | "hook" | "soundscapeUrl" | "cinematicEntranceUrl">;
    } = body;

    if (honeypot) {
      return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
    }

    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const { user, workspace } = await upsertBillingAccount({
      email: normalizedEmail,
      planType: "free",
    });
    await ensureTrialCredits({ user, workspace });

    const record = await createShareRecord({
      videoUrl: "",
      email: normalizedEmail,
      soundscapeUrl: buildResult?.soundscapeUrl,
      cinematicEntranceUrl: buildResult?.cinematicEntranceUrl,
      recipientName: buildResult?.hook?.archetype
        ? `${buildResult.hook.archetype} hook recipient`
        : "Studio campaign",
      canvas: buildResult?.canvasId
        ? {
            canvasId: buildResult.canvasId,
            provider: "melius",
            assetCount: 1,
            canvasUrl: buildResult.canvasUrl,
          }
        : undefined,
      trace: [
        {
          label: "Captured email after Studio preview",
          detail: "Unlocked 2 additional hook generations and campaign link delivery.",
          status: "complete",
        },
        ...(buildResult?.hook
          ? [{
              label: "Hook Engine tier",
              detail: `${buildResult.hook.tier} · ${buildResult.hook.archetype}`,
              status: "complete" as const,
            }]
          : []),
      ],
      privacy: "private",
      videoStyle: "hook-engine",
    });

    const response = NextResponse.json({
      ok: true,
      email: normalizedEmail,
      account: {
        userId: user.id,
        workspaceId: workspace.id,
        plan: workspace.plan || "free",
        balance: await getCreditBalance({
          workspaceId: workspace.id,
          userId: user.id,
          anonymous: false,
        }),
      },
      unlockedRerolls: 2,
      record,
      shareUrl: `/v/${record.id}`,
    });
    response.cookies.set(ACCOUNT_COOKIE, createAccountSessionCookie({ user, workspace }), accountCookieOptions());
    return response;
  } catch (error) {
    console.error("[studio/email] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Email capture failed" },
      { status: 500 }
    );
  }
}
