import { cookies } from "next/headers";
import { seal, open } from "@/lib/tokenCrypto";
import type { StoredToken } from "./types";

// Tokens are stored in an httpOnly, encrypted (AES-256-GCM) cookie. Simple and
// self-contained for a single-operator internal tool — no database required.
// Upgrade path: move to a Supabase table if multiple operators need shared state.
// seal/open live in @/lib/tokenCrypto (shared with the Google integration);
// re-exported here so existing importers keep working.
export { seal, open };

export const TOKEN_COOKIE = "li_token";

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
