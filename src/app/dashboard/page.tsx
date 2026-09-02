import { Suspense } from "react";
import { LottieIcon } from "@/components/lottie-icon";
import DashboardClient from "./dashboard-client";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LottieIcon name="spinner" className="w-10 h-10" /></div>}>
      <DashboardClient />
    </Suspense>
  );
}
