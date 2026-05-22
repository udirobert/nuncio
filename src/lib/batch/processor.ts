import { enrich, fetchRecentActivity, enrichCompany } from "@/lib/tinyfish";
import { synthesise, generateScript } from "@/lib/claude";
import { createVideo } from "@/lib/heygen";
import {
  commitCreditReservation,
  estimateCreditCost,
  getCreditSubject,
  InsufficientCreditsError,
  reserveCredits,
} from "@/lib/billing/credits";
import { sendBatchCompleteEmail } from "@/lib/email";
import { listShares } from "@/lib/share-store";
import type { Batch, BatchJob } from "./types";
import { updateJob, updateBatchStatus } from "./queue";

async function findExistingVideo(url: string): Promise<string | null> {
  try {
    const records = await listShares();
    const match = records.find((r) => {
      if (!r.videoUrl || !r.sources) return false;
      return r.sources.some((s) => s.includes(url) || url.includes(s));
    });
    if (!match) return null;
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const age = Date.now() - new Date(match.createdAt).getTime();
    if (age > thirtyDays) return null;
    return match.videoUrl ?? null;
  } catch {
    return null;
  }
}

async function dispatchWebhook(params: {
  url: string;
  batch: Batch;
}): Promise<void> {
  try {
    const response = await fetch(params.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "batch.completed",
        batch: {
          id: params.batch.id,
          name: params.batch.name,
          status: params.batch.status,
          totalJobs: params.batch.jobs.length,
          completedCount: params.batch.completedCount,
          failedCount: params.batch.failedCount,
        },
        jobs: params.batch.jobs.map((j) => ({
          id: j.id,
          url: j.url,
          recipientName: j.recipientName,
          status: j.status,
          videoId: j.videoId,
          error: j.error,
        })),
      }),
    });
    if (!response.ok) {
      console.warn(`[webhook] Dispatch to ${params.url} returned ${response.status}`);
    }
  } catch (error) {
    console.error(`[webhook] Failed to dispatch to ${params.url}:`, error);
  }
}

export async function processJob(
  job: BatchJob,
  batch: Batch,
  request: Request,
): Promise<void> {
  const subject = getCreditSubject(request);
  const researchCost = estimateCreditCost("profile.research");
  const scriptCost = estimateCreditCost("script.generate");
  const soundscapeCost = estimateCreditCost("soundscape.generate");
  const renderCost = estimateCreditCost("video.render");
  const totalCost = researchCost + scriptCost + soundscapeCost + renderCost;

  await updateJob(batch.id, job.id, { status: "processing", startedAt: new Date().toISOString() });

  try {
    const existingVideo = await findExistingVideo(job.url);
    if (existingVideo) {
      await updateJob(batch.id, job.id, {
        status: "completed",
        videoId: existingVideo,
        completedAt: new Date().toISOString(),
      });
      return;
    }

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

    const activity = await fetchRecentActivity(job.url);
    const companyContext = profile.company && profile.company !== "there"
      ? await enrichCompany(profile.company)
      : null;

    const scriptResult = await generateScript(profile, batch.senderBrief, {
      senderName: batch.senderName,
      recentActivity: activity?.markdown,
      companyContext: companyContext ?? undefined,
    });

    const video = await createVideo(
      scriptResult.script,
      [],
      profile.name || job.recipientName,
    );

    await commitCreditReservation(reservation.id);

    await updateJob(batch.id, job.id, {
      status: "completed",
      videoId: video.videoId,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      await updateJob(batch.id, job.id, {
        status: "failed",
        error: `Insufficient credits — ${error.required} required, ${error.available} available.`,
        completedAt: new Date().toISOString(),
      });
      return;
    }

    const msg = error instanceof Error ? error.message : "Unknown error";
    await updateJob(batch.id, job.id, {
      status: "failed",
      error: msg,
      completedAt: new Date().toISOString(),
    });
  }
}

export async function processBatch(batchId: string, request: Request): Promise<void> {
  const { getBatch } = await import("./queue");
  const batch = await getBatch(batchId);
  if (!batch) return;

  await updateBatchStatus(batchId, "running");

  for (const job of batch.jobs) {
    if (job.status !== "queued") continue;
    await processJob(job, batch, request);
  }

  const updated = await getBatch(batchId);
  if (!updated) return;

  const hasFailed = updated.jobs.some((j) => j.status === "failed");
  const allDone = updated.jobs.every((j) => j.status === "completed" || j.status === "failed");
  if (allDone) {
    await updateBatchStatus(batchId, hasFailed ? "failed" : "completed");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nuncio.persidian.com";

    if (updated.creatorEmail) {
      const jobs = updated.jobs.map((j) => ({
        url: j.url,
        recipientName: j.recipientName,
        status: j.status,
        videoId: j.videoId,
      }));
      sendBatchCompleteEmail({
        email: updated.creatorEmail,
        campaignName: updated.name,
        totalJobs: updated.jobs.length,
        completedCount: updated.completedCount,
        failedCount: updated.failedCount,
        jobs,
        batchUrl: `${appUrl}/batch`,
      });
    }

    if (updated.webhookUrl) {
      dispatchWebhook({ url: updated.webhookUrl, batch: updated });
    }
  }
}
