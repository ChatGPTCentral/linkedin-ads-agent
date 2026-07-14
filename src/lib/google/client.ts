import { getGoogleEnv } from "./config";
import { readGoogleToken, saveGoogleToken } from "./tokenStore";
import { refreshAccessToken, toStored } from "./oauth";

export type GoogleTokenResult = { accessToken: string } | { error: string };

/** Returns a valid Google access token, transparently refreshing if expired. */
export async function getValidGoogleToken(): Promise<GoogleTokenResult> {
  const { env, missing } = getGoogleEnv();
  if (!env) return { error: `missing_config: ${missing.join(", ")}` };
  const tok = await readGoogleToken(env.encKey);
  if (!tok) return { error: "not_connected" };
  if (tok.expiresAt > Date.now() + 60_000) return { accessToken: tok.accessToken };
  if (tok.refreshToken) {
    try {
      const fresh = toStored(await refreshAccessToken(env, tok.refreshToken));
      // Google omits refresh_token on refresh — keep the original.
      if (!fresh.refreshToken) fresh.refreshToken = tok.refreshToken;
      await saveGoogleToken(fresh, env.encKey);
      return { accessToken: fresh.accessToken };
    } catch (e) {
      return { error: `refresh_failed: ${(e as Error).message}` };
    }
  }
  return { error: "expired" };
}

// Google API calls use absolute URLs (each API is a different host), so these
// take a full URL rather than a path.
export function gGet(url: string, token: string): Promise<Response> {
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

export function gPost(url: string, body: unknown, token: string): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}
