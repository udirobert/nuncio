import { Resend } from "resend";

const FROM = process.env.RESEND_FROM || "nuncio <login@nuncio.persidian.com>";

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function baseTemplate(body: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px">
    <h1 style="font-size:22px;font-weight:500;margin:0 0 16px;letter-spacing:-0.3px">nuncio</h1>
    ${body}
    <p style="color:#999;font-size:12px;border-top:1px solid #eee;padding-top:16px;margin-top:32px">
      nuncio · persidian.com
    </p>
  </div>`;
}

export function sendMagicLinkEmail(email: string, link: string): void {
  const client = getClient();
  if (!client) {
    console.log(`[email] No RESEND_API_KEY. Magic link for ${email}: ${link}`);
    return;
  }
  client.emails.send({
    from: FROM,
    to: email,
    subject: "Sign in to nuncio",
    html: baseTemplate(`
      <p style="color:#555;font-size:15px;line-height:1.5">Click the link below to sign in. This link expires in 15 minutes.</p>
      <a href="${link}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#000;color:#fff;text-decoration:none;border-radius:8px;font-size:14px">Sign in to nuncio</a>
      <p style="color:#999;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
    `),
  }).then(() => {
    console.log(`[email] Magic link sent to ${email}`);
  }).catch((err) => {
    console.error(`[email] Failed to send magic link to ${email}:`, err);
  });
}

export interface BatchCompleteEmailParams {
  email: string;
  campaignName: string;
  totalJobs: number;
  completedCount: number;
  failedCount: number;
  jobs: Array<{ url: string; recipientName?: string; status: string; videoId?: string }>;
  batchUrl: string;
}

export async function sendBatchCompleteEmail(params: BatchCompleteEmailParams): Promise<void> {
  const client = getClient();
  if (!client) {
    console.log(`[email] No RESEND_API_KEY. Batch complete email would be sent to ${params.email}`);
    return;
  }

  const jobRows = params.jobs.map((job) => {
    const link = job.videoId
      ? `<a href="${params.batchUrl.replace(/\/batch.*/, "/v/" + job.videoId)}" style="color:#4a3aff;text-decoration:none">View video</a>`
      : `<span style="color:#c97">${job.status === "failed" ? "Failed" : "—"}</span>`;
    const name = job.recipientName ? `(${job.recipientName})` : "";
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333">${job.url} ${name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right">${link}</td>
    </tr>`;
  }).join("");

  const statusColor = params.failedCount === 0 ? "#22a67e" : params.completedCount > 0 ? "#d4973c" : "#c97";

  await client.emails.send({
    from: FROM,
    to: params.email,
    subject: `"${params.campaignName}" — batch complete (${params.completedCount}/${params.totalJobs})`,
    html: baseTemplate(`
      <p style="color:#555;font-size:15px;line-height:1.5">
        Your batch campaign <strong>${params.campaignName}</strong> has finished processing.
      </p>
      <div style="display:inline-block;background:${statusColor}10;border:1px solid ${statusColor}30;border-radius:8px;padding:12px 20px;margin:16px 0">
        <span style="font-size:28px;font-weight:600;color:${statusColor}">${params.completedCount}</span>
        <span style="color:#888;font-size:13px;margin-left:6px">/ ${params.totalJobs} videos ready</span>
        ${params.failedCount > 0 ? `<span style="color:#c97;font-size:13px;margin-left:12px">${params.failedCount} failed</span>` : ""}
      </div>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">${jobRows}</table>
      <a href="${params.batchUrl}" style="display:inline-block;margin:12px 0;padding:10px 24px;background:#000;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">View in dashboard</a>
    `),
  });

  console.log(`[email] Batch complete email sent to ${params.email}`);
}
