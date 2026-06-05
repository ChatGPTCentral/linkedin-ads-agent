import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { StoredToken } from "./types";

// Tokens are stored in an httpOnly, encrypted (AES-256-GCM) cookie. Simple and
// self-contained for a single-operator internal tool — no database required.
// Upgrade path: move to a Supabase table if multiple operators need shared state.

export const TOKEN_COOKIE = "li_token";

function keyBytes(encKey: string): Buffer {
  return crypto.createHash("sha256").update(encKey).digest();
}

export function seal(obj: unknown, encKey: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBytes(encKey), iv);
  const ct = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(obj), "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64url");
}

export function open<T>(s: string, encKey: string): T | null {
  try {
    const buf = Buffer.from(s, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const d = crypto.createDecipheriv("aes-256-gcm", keyBytes(encKey), iv);
    d.setAuthTag(tag);
    const pt = Buffer.concat([d.update(ct), d.final()]);
    return JSON.parse(pt.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export async function saveToken(t: StoredToken, encKey: string): Promise<void> {
  const c = await cookies();
  c.set(TOKEN_COOKIE, seal(t, encKey), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180, // 180 days
  });
}

export async function readStoredToken(encKey: string): Promise<StoredToken | null> {
  const c = await cookies();
  const v = c.get(TOKEN_COOKIE)?.value;
  return v ? open<StoredToken>(v, encKey) : null;
}

export async function clearToken(): Promise<void> {
  const c = await cookies();
  c.delete(TOKEN_COOKIE);
}
