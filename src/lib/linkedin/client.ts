import { LINKEDIN, getLinkedInEnv } from "./config";
import { readStoredToken, saveToken } from "./tokenStore";
import { refreshToken, toStored } from "./oauth";

export type TokenResult = { accessToken: string } | { error: string };

/** Returns a valid access token, transparently refreshing if expired. */
export async function getValidToken(): Promise<TokenResult> {
  const { env, missing } = getLinkedInEnv();
  if (!env) return { error: `missing_config: ${missing.join(", ")}` };
  const tok = await readStoredToken(env.encKey);
  if (!tok) return { error: "not_connected" };
  if (tok.expiresAt > Date.now() + 60_000) return { accessToken: tok.accessToken };
  if (tok.refreshToken && (!tok.refreshExpiresAt || tok.refreshExpiresAt > Date.now())) {
    try {
      const fresh = toStored(await refreshToken(env, tok.refreshToken));
      if (!fresh.refreshToken) fresh.refreshToken = tok.refreshToken;
      await saveToken(fresh, env.encKey);
      return { accessToken: fresh.accessToken };
    } catch (e) {
      return { error: `refresh_failed: ${(e as Error).message}` };
    }
  }
  return { error: "expired" };
}

export function liHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": LINKEDIN.version,
    "X-Restli-Protocol-Version": LINKEDIN.restliVersion,
    "Content-Type": "application/json",
  };
}

export function liGet(path: string, token: string): Promise<Response> {
  return fetch(`${LINKEDIN.apiBase}${path}`, { headers: liHeaders(token) });
}

export function liPost(path: string, body: unknown, token: string): Promise<Response> {
  return fetch(`${LINKEDIN.apiBase}${path}`, {
    method: "POST",
    headers: liHeaders(token),
    body: JSON.stringify(body),
  });
}
