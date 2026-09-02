import { Suspense } from "react";
import { LottieIcon } from "@/components/lottie-icon";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LottieIcon name="spinner" className="w-10 h-10" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
