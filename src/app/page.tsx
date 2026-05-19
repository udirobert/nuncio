import { getCachedAvatars, getCachedVoices } from "@/lib/heygen-server";
import HomeClient from "./home-client";

export default async function Home() {
  const [avatars, voices] = await Promise.all([
    getCachedAvatars().catch(() => [] as never[]),
    getCachedVoices().catch(() => [] as never[]),
  ]);

  return <HomeClient initialAvatars={avatars} initialVoices={voices} />;
}
