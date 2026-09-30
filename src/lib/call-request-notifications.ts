export interface PendingSnapshot {
  seen: Set<string>;
  fresh: string[];
}

export function updatePendingIds(
  seen: Set<string> | null,
  incoming: ReadonlyArray<{ id: string; status: string }>,
): PendingSnapshot {
  const pendingIds = incoming.filter((r) => r.status === "pending").map((r) => r.id);
  if (seen === null) {
    return { seen: new Set(incoming.map((r) => r.id)), fresh: [] };
  }
  const fresh = pendingIds.filter((id) => !seen.has(id));
  for (const id of incoming.map((r) => r.id)) seen.add(id);
  return { seen, fresh };
}

export function notifyNewCallRequest(input: {
  count: number;
  tag: string;
  permissionGranted: boolean;
}): void {
  if (!input.permissionGranted || input.count < 1) return;
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const notification = new Notification("New call request", {
      body: input.count === 1 ? "A recipient wants to talk to you." : `${input.count} recipients want to talk to you.`,
      tag: input.tag,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
  }
}
