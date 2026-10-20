import { Suspense } from "react";
import { LottieIcon } from "@/components/lottie-icon";
import SetupClient from "./setup-client";

export const metadata = {
  title: "Your representative — nuncio",
  description:
    "Tell nuncio who your AI representative speaks for, what it may offer, and the lines it must never cross.",
};

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LottieIcon name="spinner" className="w-10 h-10" /></div>}>
      <SetupClient />
    </Suspense>
  );
}
