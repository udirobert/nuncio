"use client";

import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { UrlForm } from "@/components/url-form";
import type { IntentId } from "@/components/intent-chips";

export default function ReconnectPage() {
  const router = useRouter();

  function handleSubmit(urls: string[], brief?: string, intent?: IntentId, personalMemory?: string) {
    const bridge = JSON.stringify({
      url: urls[0] || "",
      brief: brief || "",
      personalMemory: personalMemory || "",
      intent: intent || "",
    });
    try {
      sessionStorage.setItem("nuncio_studio_bridge", bridge);
    } catch { /* ignore */ }
    router.push("/studio?mode=reconnect");
  }

  return (
    <main className="min-h-screen bg-cream">
      <Header />
      <div className="pt-24 pb-12">
        <UrlForm onSubmit={handleSubmit} />
      </div>
    </main>
  );
}
