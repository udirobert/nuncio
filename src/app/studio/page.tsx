import { Suspense } from "react";
import { getCachedAvatars, getCachedVoices } from "@/lib/heygen-server";
import StudioClient from "./studio-client";

export default async function StudioPage() {
  const [avatars, voices] = await Promise.all([
    getCachedAvatars().catch(() => [] as never[]),
    getCachedVoices().catch(() => [] as never[]),
  ]);

  return (
    <Suspense>
      <StudioClient initialAvatars={avatars} initialVoices={voices} />
    </Suspense>
  );
}
