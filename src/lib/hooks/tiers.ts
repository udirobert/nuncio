import { checkRateLimit, getClientId } from "@/lib/rate-limit";

export type UserTier = "trial" | "free" | "pro" | "studio";

export interface HookTierConfig {
  tier: UserTier;
  modelLabel: string;
  modelEndpoint: string;
  estimatedCostUsd: number;
  monthlyCap: number;
  watermark: boolean;
}

export interface HookAccess {
  tier: UserTier;
  modelLabel: string;
  modelEndpoint: string;
  remainingFree: number;
  canRegenerate: boolean;
  watermark: boolean;
  generationAllowed: boolean;
  reason?: string;
}

const HOOK_DAILY_BUDGET_USD = Number(process.env.HOOK_DAILY_BUDGET_USD || 10);

const HOOK_MODEL_FOR_TIER: Record<UserTier, HookTierConfig> = {
  trial: {
    tier: "trial",
    modelLabel: "fal Wan 2.5",
    modelEndpoint: process.env.FAL_HOOK_MODEL_TRIAL || process.env.FAL_HOOK_MODEL || "",
    estimatedCostUsd: Number(process.env.HOOK_COST_TRIAL_USD || 0.05),
    monthlyCap: 1,
    watermark: true,
  },
  free: {
    tier: "free",
    modelLabel: "fal LTX or Wan",
    modelEndpoint: process.env.FAL_HOOK_MODEL_FREE || process.env.FAL_HOOK_MODEL_TRIAL || process.env.FAL_HOOK_MODEL || "",
    estimatedCostUsd: Number(process.env.HOOK_COST_FREE_USD || 0.05),
    monthlyCap: 3,
    watermark: true,
  },
  pro: {
    tier: "pro",
    modelLabel: "fal Kling 2.0",
    modelEndpoint: process.env.FAL_HOOK_MODEL_PRO || process.env.FAL_HOOK_MODEL || "",
    estimatedCostUsd: Number(process.env.HOOK_COST_PRO_USD || 0.4),
    monthlyCap: 50,
    watermark: false,
  },
  studio: {
    tier: "studio",
    modelLabel: "fal Veo3",
    modelEndpoint: process.env.FAL_HOOK_MODEL_STUDIO || process.env.FAL_HOOK_MODEL || "",
    estimatedCostUsd: Number(process.env.HOOK_COST_STUDIO_USD || 1.5),
    monthlyCap: 200,
    watermark: false,
  },
};

const spendByDay = new Map<string, number>();

export function resolveHookAccess(request: Request, email?: string | null): HookAccess {
  const tier: UserTier = email ? "free" : "trial";
  const config = HOOK_MODEL_FOR_TIER[tier];
  const clientId = getClientId(request);
  const cookieSession = parseCookie(request.headers.get("cookie") || "").nuncio_trial_id;
  const sessionKey = email || cookieSession || clientId;
  const rateKey = `${clientId}:${sessionKey}`;

  if (!config.modelEndpoint) {
    return {
      tier,
      modelLabel: config.modelLabel,
      modelEndpoint: "",
      remainingFree: tier === "trial" ? 0 : Math.max(0, config.monthlyCap - 1),
      canRegenerate: tier !== "trial",
      watermark: config.watermark,
      generationAllowed: false,
      reason: "FAL_HOOK_MODEL_TRIAL is not configured; returning hook demo mode.",
    };
  }

  if (todaySpendUsd() + config.estimatedCostUsd > HOOK_DAILY_BUDGET_USD) {
    return {
      tier,
      modelLabel: config.modelLabel,
      modelEndpoint: config.modelEndpoint,
      remainingFree: 0,
      canRegenerate: false,
      watermark: config.watermark,
      generationAllowed: false,
      reason: "Daily hook budget reached; returning hook demo mode.",
    };
  }

  if (tier === "trial") {
    const limit = checkRateLimit(rateKey, "hook:trial", { maxRequests: 1, windowSeconds: 24 * 60 * 60 });
    return {
      tier,
      modelLabel: config.modelLabel,
      modelEndpoint: config.modelEndpoint,
      remainingFree: limit.remaining,
      canRegenerate: false,
      watermark: config.watermark,
      generationAllowed: limit.allowed,
      reason: limit.allowed ? undefined : `Trial hook already used. Try again in ${limit.resetIn}s or drop email for more.`,
    };
  }

  return {
    tier,
    modelLabel: config.modelLabel,
    modelEndpoint: config.modelEndpoint,
    remainingFree: Math.max(0, config.monthlyCap - 1),
    canRegenerate: true,
    watermark: config.watermark,
    generationAllowed: true,
  };
}

export function recordHookSpend(tier: UserTier): void {
  const config = HOOK_MODEL_FOR_TIER[tier];
  const key = dayKey();
  spendByDay.set(key, todaySpendUsd() + config.estimatedCostUsd);
}

export function ensureTrialCookie(response: Response, request: Request): void {
  const cookies = parseCookie(request.headers.get("cookie") || "");
  if (cookies.nuncio_trial_id) return;

  const id = crypto.randomUUID();
  response.headers.append(
    "Set-Cookie",
    `nuncio_trial_id=${id}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`
  );
}

function todaySpendUsd(): number {
  return spendByDay.get(dayKey()) || 0;
}

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseCookie(cookieHeader: string): Record<string, string> {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf("=");
        if (idx === -1) return [part, ""];
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      })
  );
}
