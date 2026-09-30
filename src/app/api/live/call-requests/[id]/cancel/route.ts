import { NextRequest, NextResponse } from "next/server";
import { getCallRequestStorageProvider } from "@/lib/storage";
import {
  authenticateCallRequest,
  browserMutationAllowed,
  getCallRequest,
  terminalizeCallRequest,
} from "@/lib/call-request";

const NO_STORE = { "Cache-Control": "no-store" };

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Cancel an open request — also the owner's "End call". Either side can
 * cancel (recipient via their capability token, owner via their session) from
 * pending or accepted; a repeated cancel on an already-cancelled record is an
 * idempotent 200, other terminal states are 409. Cancellation tears down the
 * LiveKit room through the shared lifecycle path.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const raw = await getCallRequestStorageProvider().get(id);
  if (!raw) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  const auth = await authenticateCallRequest(request, raw);
  if (!auth) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  if (auth.role === "owner" && !browserMutationAllowed(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  }
  const record = await getCallRequest(id);
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }

  const cancelled = await terminalizeCallRequest(record.id, "cancelled", ["pending", "accepted"]);
  if (!cancelled || cancelled.status !== "cancelled") {
    const current = await getCallRequest(record.id);
    return NextResponse.json(
      { error: "Request can no longer be cancelled", status: current?.status ?? "unknown" },
      { status: 409, headers: NO_STORE },
    );
  }
  return NextResponse.json(
    { id: cancelled.id, status: cancelled.status, cleanupError: Boolean(cancelled.cleanupError) },
    { headers: NO_STORE },
  );
}
