import { Suspense } from "react";
import { LottieIcon } from "@/components/lottie-icon";
import { getCachedAvatars, getCachedVoices } from "@/lib/heygen-server";
import { isLiveLinkEnabled, getAnamAvatarTrainingCreditCost, getAnamVoiceTrainingCreditCost } from "@/lib/live-link";
import StudioClient from "./studio-client";

export default async function StudioPage() {
  const [avatars, voices] = await Promise.all([
    getCachedAvatars().catch(() => [] as never[]),
    getCachedVoices().catch(() => [] as never[]),
  ]);

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LottieIcon name="spinner" className="w-10 h-10" /></div>}>
      <StudioClient
        initialAvatars={avatars}
        initialVoices={voices}
        liveLinkEnabled={isLiveLinkEnabled()}
        avatarTrainingCost={getAnamAvatarTrainingCreditCost()}
        voiceTrainingCost={getAnamVoiceTrainingCreditCost()}
      />
    </Suspense>
  );
}
