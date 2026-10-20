import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LottieIcon } from "@/components/lottie-icon";
import { APP_ROUTES } from "@/lib/navigation";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  // Setup used to be a query-string variant of this page. It is a real route
  // now — redirect old links server-side so the destination is unambiguous
  // in the URL bar, in history, and in any shared link.
  const params = await searchParams;
  if (params.view === "setup") {
    redirect(APP_ROUTES.representative);
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LottieIcon name="spinner" className="w-10 h-10" /></div>}>
      <DashboardClient />
    </Suspense>
  );
}
