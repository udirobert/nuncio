import { NextRequest, NextResponse } from "next/server";
import { createShareRecord } from "@/lib/share-store";
import type { StudioBuildResult } from "@/lib/creative/melius-provider";

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
      buildResult?: Pick<StudioBuildResult, "canvasId" | "canvasUrl" | "projectId" | "hook">;
    } = body;

    if (honeypot) {
      return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
    }

    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const record = await createShareRecord({
      videoUrl: "",
      email: normalizedEmail,
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
              detail: `${buildResult.hook.tier} · ${buildResult.hook.model} · ${buildResult.hook.archetype}`,
              status: "complete" as const,
            }]
          : []),
      ],
      privacy: "private",
      videoStyle: "hook-engine",
    });

    return NextResponse.json({
      ok: true,
      email: normalizedEmail,
      unlockedRerolls: 2,
      record,
      shareUrl: `/v/${record.id}`,
    });
  } catch (error) {
    console.error("[studio/email] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Email capture failed" },
      { status: 500 }
    );
  }
}
