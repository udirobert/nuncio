import { NextRequest, NextResponse } from "next/server";
import { getCreditBalance, getCreditSubject } from "@/lib/billing/credits";
import { getAccountStorageProvider } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const subject = getCreditSubject(request);
  const balance = await getCreditBalance(subject);

  if (subject.workspaceId.startsWith("anon:")) {
    return NextResponse.json({
      workspaceId: subject.workspaceId,
      anonymous: true,
      balance,
      transactions: [],
    });
  }

  const summary = await getAccountStorageProvider().getCreditSummary(subject.workspaceId);

  return NextResponse.json({
    workspaceId: subject.workspaceId,
    anonymous: subject.anonymous,
    balance,
    plan: summary?.workspace.plan || "free",
    transactions: summary?.transactions.slice(-20).reverse() || [],
  });
}
