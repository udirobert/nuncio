import { enrich } from "@/lib/tinyfish";
import { synthesise, generateScript } from "@/lib/claude";
import { createVideo } from "@/lib/heygen";
import {
  commitCreditReservation,
  estimateCreditCost,
  getCreditSubject,
  InsufficientCreditsError,
  reserveCredits,
} from "@/lib/billing/credits";
import type { Batch, BatchJob } from "./types";
import { updateJob, updateBatchStatus } from "./queue";

export async function processJob(
  job: BatchJob,
  batch: Batch,
  request: Request,
): Promise<void> {
  const subject = getCreditSubject(request);
  const researchCost = estimateCreditCost("profile.research");
  const scriptCost = estimateCreditCost("script.generate");
  const renderCost = estimateCreditCost("video.render");
  const totalCost = researchCost + scriptCost + renderCost;

  updateJob(batch.id, job.id, { status: "processing", startedAt: new Date().toISOString() });

  try {
    const reservation = await reserveCredits({
      subject,
      action: "video.render",
      amount: totalCost,
      reason: `Batch: ${batch.name} — ${job.url}`,
      flowId: batch.id,
      provider: "batch",
    });

    const enrichment = await enrich([job.url], { discoverRelated: true });
    const markdown = enrichment.filter((r) => r.success).map((r) => r.markdown);
    if (markdown.length === 0) {
      throw new Error("Could not access profile — page may be behind a login wall");
    }

    const profile = await synthesise(markdown);
    if (profile.name === "there") {
      throw new Error("Could not identify a person from this profile");
    }

    const scriptResult = await generateScript(profile, batch.senderBrief, {
      senderName: batch.senderName,
    });

    const video = await createVideo(
      scriptResult.script,
      [],
      profile.name || job.recipientName,
    );

    await commitCreditReservation(reservation.id);

    updateJob(batch.id, job.id, {
      status: "completed",
      videoId: video.videoId,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      updateJob(batch.id, job.id, {
        status: "failed",
        error: `Insufficient credits — ${error.required} required, ${error.available} available.`,
        completedAt: new Date().toISOString(),
      });
      return;
    }

    const msg = error instanceof Error ? error.message : "Unknown error";
    updateJob(batch.id, job.id, {
      status: "failed",
      error: msg,
      completedAt: new Date().toISOString(),
    });
  }
}

export async function processBatch(batchId: string, request: Request): Promise<void> {
  const { getBatch } = await import("./queue");
  const batch = getBatch(batchId);
  if (!batch) return;

  updateBatchStatus(batchId, "running");

  for (const job of batch.jobs) {
    if (job.status !== "queued") continue;
    await processJob(job, batch, request);
  }

  const updated = getBatch(batchId);
  if (updated) {
    const hasFailed = updated.jobs.some((j) => j.status === "failed");
    const allDone = updated.jobs.every((j) => j.status === "completed" || j.status === "failed");
    if (allDone) {
      updateBatchStatus(batchId, hasFailed ? "failed" : "completed");
    }
  }
}
