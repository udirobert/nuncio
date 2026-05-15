import type { ShareRecord } from "@/lib/artifacts";
import type { ProofPublishResult, ProofStorageProvider } from "./types";

const GROVE_API_URL = process.env.GROVE_API_URL || "https://api.grove.storage";
const GROVE_CHAIN_ID = process.env.GROVE_CHAIN_ID || "37111"; // Lens testnet by default.

export class GroveProofStorageProvider implements ProofStorageProvider {
  readonly name = "grove";

  async publish(record: ShareRecord): Promise<ProofPublishResult | null> {
    const proof = buildRedactedProof(record);
    const response = await fetch(`${GROVE_API_URL}/?chain_id=${GROVE_CHAIN_ID}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(proof),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Grove upload failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    return {
      provider: this.name,
      uri: data.uri,
      gatewayUrl: data.gateway_url || data.gatewayUrl,
      storageKey: data.storage_key || data.storageKey,
    };
  }
}

function buildRedactedProof(record: ShareRecord) {
  return {
    schema: "nuncio.proof.v1",
    shareId: record.id,
    createdAt: record.createdAt,
    video: {
      provider: "heygen",
      videoId: record.videoId,
      hasVideoUrl: Boolean(record.videoUrl),
    },
    canvas: record.canvas
      ? {
          provider: record.canvas.provider,
          canvasUrl: record.canvas.canvasUrl,
          assetCount: record.canvas.assetCount,
        }
      : undefined,
    sources: record.sources?.map((source) => safeHost(source)),
    trace: record.trace?.map((item) => ({
      label: item.label,
      status: item.status,
    })),
  };
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}