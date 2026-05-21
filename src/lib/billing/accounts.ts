import { getAccountStorageProvider } from "@/lib/storage";
import type { AccountUser, WorkspaceAccount } from "@/lib/storage";
import { grantCredits } from "@/lib/billing/credits";

const PLAN_CREDITS: Record<string, number> = {
  "pro-monthly": 200,
  "pro-annual": 2400,
  pro: 200,
  studio: 1000,
};

export function creditsForPlan(planType?: string): number {
  if (!planType) return PLAN_CREDITS.pro;
  return PLAN_CREDITS[planType] ?? PLAN_CREDITS.pro;
}

export async function upsertBillingAccount(input: {
  email: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  planType?: string;
}): Promise<{ user: AccountUser; workspace: WorkspaceAccount }> {
  const provider = getAccountStorageProvider();
  const user = await provider.upsertUserByEmail(input.email, {
    stripeCustomerId: input.stripeCustomerId,
  });
  const workspace = await provider.upsertWorkspaceForUser(user, {
    name: input.email,
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    plan: normalizePlan(input.planType),
  });

  return { user, workspace };
}

export async function ensureTrialCredits(input: {
  workspace: WorkspaceAccount;
  user?: AccountUser;
}): Promise<number> {
  const summary = await getAccountStorageProvider().getCreditSummary(input.workspace.id);
  if (summary && summary.transactions.length > 0) return 0;

  const amount = Number(process.env.NUNCIO_TRIAL_CREDITS || 10);
  const grantAmount = Number.isFinite(amount) ? amount : 10;
  await grantCredits({
    workspaceId: input.workspace.id,
    userId: input.user?.id || input.workspace.ownerUserId,
    amount: grantAmount,
    reason: "account_trial_grant",
  });
  return grantAmount;
}

export async function grantPlanCredits(input: {
  workspace: WorkspaceAccount;
  user?: AccountUser;
  planType?: string;
  stripeEventId?: string;
  stripeInvoiceId?: string;
  reason: string;
}): Promise<number> {
  const summary = await getAccountStorageProvider().getCreditSummary(input.workspace.id);
  const alreadyGranted = summary?.transactions.some((transaction) => {
    const metadata = transaction.metadata || {};
    return (
      (input.stripeEventId && metadata.stripeEventId === input.stripeEventId) ||
      (input.stripeInvoiceId && metadata.stripeInvoiceId === input.stripeInvoiceId)
    );
  });
  if (alreadyGranted) return 0;

  const amount = creditsForPlan(input.planType);
  await grantCredits({
    workspaceId: input.workspace.id,
    userId: input.user?.id || input.workspace.ownerUserId,
    amount,
    reason: input.reason,
    metadata: {
      planType: input.planType || "pro",
      stripeEventId: input.stripeEventId,
      stripeInvoiceId: input.stripeInvoiceId,
    },
  });
  return amount;
}

export async function getWorkspaceForStripeCustomer(customerId: string): Promise<WorkspaceAccount | null> {
  return getAccountStorageProvider().getWorkspaceByStripeCustomerId(customerId);
}

export async function updateWorkspaceSubscription(input: {
  customerId: string;
  stripeSubscriptionId?: string;
  plan?: "free" | "pro" | "studio";
}): Promise<WorkspaceAccount | null> {
  const provider = getAccountStorageProvider();
  const workspace = await provider.getWorkspaceByStripeCustomerId(input.customerId);
  if (!workspace) return null;
  return provider.updateWorkspace(workspace.id, {
    stripeSubscriptionId: input.stripeSubscriptionId,
    plan: input.plan,
  });
}

function normalizePlan(planType?: string): "free" | "pro" | "studio" {
  if (planType === "studio") return "studio";
  if (planType?.startsWith("pro") || planType === undefined) return "pro";
  return "free";
}
