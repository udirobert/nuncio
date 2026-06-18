/**
 * Formatting helpers for pipeline activity messages.
 *
 * Produces the same markdown structure that the Band agents emit,
 * so the collaborative panel renders consistently regardless of
 * whether events come from the server pipeline or remote agents.
 */

import type { Profile, ScriptResult } from "@/lib/claude";

interface EnrichmentResult {
  url: string;
  success: boolean;
  markdown?: string;
  reason?: string;
}

export function formatResearchSummary(results: EnrichmentResult[]): string {
  const successful = results.filter((r) => r.success && r.markdown);
  const failed = results.filter((r) => !r.success);

  const lines = [
    "## Research Results",
    "",
    `**Enriched:** ${successful.length} profile(s) | **Failed:** ${failed.length}`,
    "",
  ];

  for (const r of successful) {
    const preview = (r.markdown || "").slice(0, 400);
    lines.push(`### ${r.url}`);
    lines.push(preview + ((r.markdown || "").length > 400 ? "..." : ""));
    lines.push("");
  }

  if (failed.length > 0) {
    lines.push("### Failed URLs");
    for (const r of failed) {
      lines.push(`- ${r.url}: ${r.reason || "unknown error"}`);
    }
  }

  return lines.join("\n");
}

export function formatProfileSummary(profile: Profile): string {
  const lines = ["## Recipient Profile", ""];
  lines.push(`**${profile.name}**`);
  if (profile.current_role) lines.push(profile.current_role);
  if (profile.company) lines.push(`at ${profile.company}`);
  if (profile.notable_work) lines.push(`Notable: ${profile.notable_work}`);
  return lines.join("\n");
}

export function formatScriptDraft(
  script: ScriptResult,
  profile: Profile,
): string {
  const lines = ["## Script Draft", ""];

  if (profile.name) {
    lines.push(`### For ${profile.name}`);
    if (profile.current_role) lines.push(`*${profile.current_role}*`);
    lines.push("");
  }

  if (script.vibeId) {
    lines.push(`**Tone:** ${script.vibeId}`);
    if (script.vibeReasoning) lines.push(`*${script.vibeReasoning}*`);
    lines.push("");
  }

  lines.push("### Script");
  lines.push(script.script || "*No script generated*");
  lines.push("");
  lines.push("---");
  lines.push("*Ready for review.*");

  return lines.join("\n");
}

interface ValidationIssue {
  category: string;
  detail: string;
}

export function formatReview(
  issues: ValidationIssue[],
  wordCount: number,
): string {
  if (issues.length === 0) {
    return [
      "## Script Review — Approved",
      "",
      `**Word count:** ${wordCount} | **Compliance:** passed`,
      "",
      "Script meets all quality checks.",
      "Ready for video production.",
    ].join("\n");
  }

  const lines = [
    "## Script Review — Edits Required",
    "",
    `**Issues found:** ${issues.length}`,
    "",
  ];

  for (let i = 0; i < issues.length; i++) {
    lines.push(`${i + 1}. **${issues[i].category}**: ${issues[i].detail}`);
  }

  return lines.join("\n");
}
