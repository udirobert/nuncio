export interface FinalUtterance {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export function normalizeAnamHistory(
  messages: ReadonlyArray<{ id?: string; role: string; content: string; interrupted?: boolean }>,
): FinalUtterance[] {
  const seen = new Set<string>();
  const out: FinalUtterance[] = [];
  for (const message of messages) {
    if (message.interrupted) continue;
    const role = message.role === "user" ? "user" : message.role === "persona" ? "assistant" : null;
    if (!role) continue;
    const id = message.id || `anam-${out.length}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, role, text: message.content });
  }
  return out;
}

export function normalizeLiveKitSegments(
  segments: ReadonlyArray<{ id: string; final: boolean; text: string }>,
  input: { isRecipient: boolean },
): FinalUtterance[] {
  const role = input.isRecipient ? "user" : "assistant";
  const out: FinalUtterance[] = [];
  for (const segment of segments) {
    if (!segment.final || !segment.text?.trim()) continue;
    out.push({ id: segment.id, role, text: segment.text });
  }
  return out;
}
