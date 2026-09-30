export type SchedulingProviderId = "calcom" | "calendly" | "link";

export interface SchedulingProviderInfo {
  id: SchedulingProviderId;
  capabilities: { embed: boolean; lifecycle: boolean };
  url: string;
  host: string;
}

const IPV4_LITERAL = /^\d{1,3}(\.\d{1,3}){3}$/;

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (!host.includes(".")) return true;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.startsWith("[")) return true;
  if (IPV4_LITERAL.test(host)) return true;
  return false;
}

export function resolveSchedulingProvider(raw: string | null | undefined): SchedulingProviderInfo | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.hash) return null;
  for (const key of url.searchParams.keys()) {
    if (key.startsWith("metadata[") || key === "nuncioContext") return null;
  }
  const host = url.hostname.toLowerCase();
  if (isPrivateHost(host)) return null;
  if (host === "cal.com" || host === "app.cal.com") {
    return { id: "calcom", capabilities: { embed: true, lifecycle: true }, url: url.toString(), host };
  }
  if (host === "calendly.com") {
    return { id: "calendly", capabilities: { embed: true, lifecycle: false }, url: url.toString(), host };
  }
  return { id: "link", capabilities: { embed: false, lifecycle: false }, url: url.toString(), host };
}
