import { NextRequest, NextResponse } from "next/server";
import { getShareRecord } from "@/lib/share-store";
import { getSchedulingStorageProvider } from "@/lib/storage";
import {
  getCalcomPilotConfig,
  verifySchedulingContextToken,
} from "@/lib/scheduling-server";
import {
  CALCOM_MAX_BODY_BYTES,
  parseCalcomWebhook,
  verifyCalcomSignature,
} from "@/lib/calcom-webhook";

const NO_STORE = { "Cache-Control": "no-store" };

async function readBoundedBody(request: NextRequest): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) {
    const text = await request.text();
    return Buffer.byteLength(text, "utf8") <= CALCOM_MAX_BODY_BYTES ? text : null;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > CALCOM_MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}

export async function POST(request: NextRequest) {
  const config = getCalcomPilotConfig();
  if (!config) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }

  const raw = await readBoundedBody(request);
  if (raw === null) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413, headers: NO_STORE });
  }

  const signature = request.headers.get("x-cal-signature-256") || "";
  if (!verifyCalcomSignature(raw, signature, config.webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401, headers: NO_STORE });
  }

  const parsed = parseCalcomWebhook(raw, config);
  if (parsed.kind === "invalid") {
    return NextResponse.json({ error: "Malformed body" }, { status: 400, headers: NO_STORE });
  }
  if (parsed.kind === "ignored") {
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  const contextId = verifySchedulingContextToken(parsed.contextToken, config.contextSecret);
  if (!contextId) {
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  try {
    const storage = getSchedulingStorageProvider();
    const record = await storage.get(contextId);
    if (!record
      || record.provider !== "calcom"
      || record.workspaceId !== config.workspaceId
      || record.eventTypeId !== config.eventTypeId) {
      return NextResponse.json({ ok: true }, { headers: NO_STORE });
    }

    const share = await getShareRecord(record.shareId);
    if (!share || share.id !== record.shareId || share.workspaceId !== record.workspaceId) {
      return NextResponse.json({ ok: true }, { headers: NO_STORE });
    }

    await storage.applyProviderEvent(contextId, parsed.event);
  } catch {
    return NextResponse.json({ error: "Storage failure" }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
