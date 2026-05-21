import { NextRequest, NextResponse } from "next/server";
import { MeliusProvider, resetMeliusSession } from "@/lib/creative/melius-provider";
import {
  commitCreditReservation,
  estimateCreditCost,
  getCreditBalance,
  getCreditSubject,
  InsufficientCreditsError,
  refundCreditReservation,
  reserveCredits,
} from "@/lib/billing/credits";

export async function POST(request: NextRequest) {
  const subject = getCreditSubject(request);
  const creditCost = estimateCreditCost("canvas.build");
  let reservationId: string | undefined;

  try {
    const { nodeId, prompt, canvasId, meliusApiKey } = await request.json();

    if (!nodeId) {
      return NextResponse.json({ error: "nodeId is required" }, { status: 400 });
    }
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const reservation = await reserveCredits({
      subject,
      action: "canvas.build",
      amount: creditCost,
      reason: "Regenerate canvas node (studio iterate)",
      provider: "melius",
    });
    reservationId = reservation.id;

    resetMeliusSession();
    const melius = new MeliusProvider(meliusApiKey || undefined);

    await melius.updateNodePrompt(nodeId, prompt, canvasId);
    const runId = await melius.startRun(nodeId, canvasId);

    let status = "running";
    let outputUrl: string | undefined;
    const pollStart = Date.now();

    while (status === "running" && Date.now() - pollStart < 30000) {
      await new Promise((r) => setTimeout(r, 2000));
      const runStatus = await melius.getRunStatus(runId, canvasId);
      status = runStatus.status;
      if (runStatus.outputUrl) {
        outputUrl = runStatus.outputUrl;
      }
    }

    await commitCreditReservation(reservation.id);

    return NextResponse.json(
      {
        runId,
        status: outputUrl ? "complete" : status,
        outputUrl,
      },
      {
        headers: {
          "X-Nuncio-Credits-Charged": String(creditCost),
          "X-Nuncio-Credits-Balance": String(await getCreditBalance(subject)),
        },
      }
    );
  } catch (error) {
    if (reservationId) {
      await refundCreditReservation(reservationId);
    }

    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: error.message,
          requiredCredits: error.required,
          availableCredits: error.available,
        },
        { status: 402 }
      );
    }

    console.error("[studio/iterate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Iteration failed" },
      { status: 500 }
    );
  }
}
