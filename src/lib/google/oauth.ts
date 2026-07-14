import { GOOGLE, type GoogleEnv } from "./config";
import type { GoogleTokenResponse, GoogleStoredToken } from "./types";

// Reuse the shared HMAC signed-state helpers (same as the LinkedIn flow).
export { makeState, verifyState } from "@/lib/oauthState";

export function buildAuthUrl(env: GoogleEnv, state: string): string {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: env.clientId,
    redirect_uri: env.redirectUri,
    scope: GOOGLE.scopes.join(" "),
    state,
    // access_type=offline + prompt=consent → guarantees a refresh_token.
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
  });
  return `${GOOGLE.authBase}?${p.toString()}`;
}

async function tokenRequest(body: Record<string, string>): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) throw new Error(`Google token error ${res.status}: ${await res.text()}`);
  return (await res.json()) as GoogleTokenResponse;
}

export function exchangeCode(env: GoogleEnv, code: string): Promise<GoogleTokenResponse> {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    client_id: env.clientId,
    client_secret: env.clientSecret,
    redirect_uri: env.redirectUri,
  });
}

export function refreshAccessToken(env: GoogleEnv, rt: string): Promise<GoogleTokenResponse> {
  return tokenRequest({
    grant_type: "refresh_token",
    refresh_token: rt,
    client_id: env.clientId,
    client_secret: env.clientSecret,
  });
}

export function toStored(r: GoogleTokenResponse): GoogleStoredToken {
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiresAt: Date.now() + r.expires_in * 1000,
    scope: r.scope,
    idToken: r.id_token,
  };
}
