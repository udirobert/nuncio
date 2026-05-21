import crypto from "node:crypto";
import type { AccountUser, WorkspaceAccount } from "@/lib/storage";

export const ACCOUNT_COOKIE = "nuncio_account";

export interface AccountSession {
  userId: string;
  workspaceId: string;
  email: string;
}

export function createAccountSessionCookie(input: {
  user: AccountUser;
  workspace: WorkspaceAccount;
}): string {
  const session: AccountSession = {
    userId: input.user.id,
    workspaceId: input.workspace.id,
    email: input.user.email,
  };
  const payload = toBase64Url(JSON.stringify(session));
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function readAccountSession(request: Request): AccountSession | null {
  const raw = parseCookie(request.headers.get("cookie") || "")[ACCOUNT_COOKIE];
  if (!raw) return null;

  const [payload, signature] = raw.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;

  try {
    return JSON.parse(fromBase64Url(payload)) as AccountSession;
  } catch {
    return null;
  }
}

export function accountCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  };
}

function sign(payload: string): string {
  const secret = process.env.NUNCIO_SESSION_SECRET || process.env.STRIPE_WEBHOOK_SECRET || "nuncio-dev-session-secret";
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function parseCookie(cookieHeader: string): Record<string, string> {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}
