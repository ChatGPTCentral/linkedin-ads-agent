import { cookies } from "next/headers";
import { seal, open } from "@/lib/tokenCrypto";
import type { GoogleStoredToken } from "./types";

// Google token in its own httpOnly, AES-256-GCM encrypted cookie (separate from
// LinkedIn's li_token). Single-operator model; upgrade to Supabase for multi-user.

export const G_TOKEN_COOKIE = "g_token";

export async function saveGoogleToken(t: GoogleStoredToken, encKey: string): Promise<void> {
  const c = await cookies();
  c.set(G_TOKEN_COOKIE, seal(t, encKey), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180, // 180 days
  });
}

export async function readGoogleToken(encKey: string): Promise<GoogleStoredToken | null> {
  const c = await cookies();
  const v = c.get(G_TOKEN_COOKIE)?.value;
  return v ? open<GoogleStoredToken>(v, encKey) : null;
}

export async function clearGoogleToken(): Promise<void> {
  const c = await cookies();
  c.delete(G_TOKEN_COOKIE);
}
