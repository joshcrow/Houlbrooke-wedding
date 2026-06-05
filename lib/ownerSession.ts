import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";

// Owner auth uses a short-lived signed cookie instead of passing the passcode
// around in URLs/bodies. The signing key is OWNER_PASSCODE itself, so there's
// no extra secret to manage; changing the passcode invalidates old sessions.
export const OWNER_COOKIE = "kc_owner";
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function secret(): string {
  return process.env.OWNER_PASSCODE ?? "";
}

export function createSessionToken(): string {
  const exp = String(Date.now() + TTL_MS);
  const sig = crypto.createHmac("sha256", secret()).update(exp).digest("hex");
  return `${exp}.${sig}`;
}

export function verifySessionToken(token?: string | null): boolean {
  const key = secret();
  if (!key || !token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || expMs < Date.now()) return false;
  const expected = crypto.createHmac("sha256", key).update(exp).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Read the owner session from the request cookies (server components + routes).
export function isOwnerAuthed(): boolean {
  return verifySessionToken(cookies().get(OWNER_COOKIE)?.value);
}

export const OWNER_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: TTL_MS / 1000,
};
