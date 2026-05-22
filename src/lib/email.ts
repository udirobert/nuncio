import { Resend } from "resend";

const FROM = process.env.RESEND_FROM || "nuncio <login@nuncio.persidian.com>";

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const STYLES = `
body{margin:0;padding:0;background-color:#f5f5f5}
.container{max-width:520px;margin:0 auto;padding:32px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff}
.logo{font-size:22px;font-weight:500;margin:0 0 16px;letter-spacing:-0.3px}
.body-text{color:#555;font-size:15px;line-height:1.6;margin:0 0 16px}
.btn{display:inline-block;margin:20px 0;padding:14px 32px;background:#000;color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:500;text-align:center}
.subtle{color:#999;font-size:13px;margin:0}
.footer{color:#999;font-size:12px;border-top:1px solid #eee;padding-top:16px;margin-top:32px}
.status-badge{display:inline-block;border-radius:8px;padding:12px 20px;margin:16px 0}
.status-count{font-size:28px;font-weight:600}
.status-label{color:#888;font-size:13px;margin-left:6px}
.job-table{width:100%;border-collapse:collapse;margin:16px 0}
.job-cell{padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333}
.job-link{color:#4a3aff;text-decoration:none;font-weight:500}
.job-fail{color:#c97}

@media (max-width:480px){
.container{padding:24px 16px}
.logo{font-size:20px}
.body-text{font-size:14px}
.btn{display:block;padding:16px 20px;font-size:16px;margin:16px 0}
.status-count{font-size:24px}
.job-cell{font-size:12px;padding:6px 8px}
.footer{font-size:11px}
}
`;

function wrap(html: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${STYLES}</style></head>
<body><div class="container">
<h1 class="logo">nuncio</h1>
${html}
<p class="footer">nuncio · persidian.com</p>
</div></body>
</html>`;
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
    html: wrap(`
      <p class="body-text">Click the link below to sign in. This link expires in 15 minutes.</p>
      <a href="${link}" class="btn">Sign in to nuncio</a>
      <p class="subtle">If you didn't request this, you can safely ignore this email.</p>
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
      ? `<a href="${params.batchUrl.replace(/\/batch.*/, "/v/" + job.videoId)}" class="job-link">View video</a>`
      : `<span class="job-fail">${job.status === "failed" ? "Failed" : "—"}</span>`;
    const name = job.recipientName ? `(${job.recipientName})` : "";
    return `<tr>
      <td class="job-cell">${job.url} ${name}</td>
      <td class="job-cell" style="text-align:right">${link}</td>
    </tr>`;
  }).join("");

  const statusColor = params.failedCount === 0 ? "#22a67e" : params.completedCount > 0 ? "#d4973c" : "#c97";

  await client.emails.send({
    from: FROM,
    to: params.email,
    subject: `"${params.campaignName}" — batch complete (${params.completedCount}/${params.totalJobs})`,
    html: wrap(`
      <p class="body-text">
        Your batch campaign <strong>${params.campaignName}</strong> has finished processing.
      </p>
      <div class="status-badge" style="background:${statusColor}10;border:1px solid ${statusColor}30">
        <span class="status-count" style="color:${statusColor}">${params.completedCount}</span>
        <span class="status-label">/ ${params.totalJobs} videos ready</span>
        ${params.failedCount > 0 ? `<span style="color:#c97;font-size:13px;margin-left:12px">${params.failedCount} failed</span>` : ""}
      </div>
      <table class="job-table">${jobRows}</table>
      <a href="${params.batchUrl}" class="btn" style="margin:12px 0;padding:12px 24px;font-size:14px">View in dashboard</a>
    `),
  });

  console.log(`[email] Batch complete email sent to ${params.email}`);
}
