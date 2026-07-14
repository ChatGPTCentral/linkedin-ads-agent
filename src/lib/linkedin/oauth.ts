import { LINKEDIN, type LinkedInEnv } from "./config";
import type { LinkedInTokenResponse, StoredToken } from "./types";

// Signed CSRF state helpers are shared with the Google flow; re-export so the
// LinkedIn auth/callback routes keep importing them from here.
export { makeState, verifyState } from "@/lib/oauthState";

export function buildAuthUrl(env: LinkedInEnv, state: string): string {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: env.clientId,
    redirect_uri: env.redirectUri,
    scope: LINKEDIN.scopes.join(" "),
    state,
  });
  return `${LINKEDIN.authBase}/authorization?${p.toString()}`;
}

async function tokenRequest(body: Record<string, string>): Promise<LinkedInTokenResponse> {
  const res = await fetch(`${LINKEDIN.authBase}/accessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) throw new Error(`LinkedIn token error ${res.status}: ${await res.text()}`);
  return (await res.json()) as LinkedInTokenResponse;
}

export function exchangeCode(env: LinkedInEnv, code: string): Promise<LinkedInTokenResponse> {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    client_id: env.clientId,
    client_secret: env.clientSecret,
    redirect_uri: env.redirectUri,
  });
}

export function refreshToken(env: LinkedInEnv, rt: string): Promise<LinkedInTokenResponse> {
  return tokenRequest({
    grant_type: "refresh_token",
    refresh_token: rt,
    client_id: env.clientId,
    client_secret: env.clientSecret,
  });
}

export function toStored(r: LinkedInTokenResponse): StoredToken {
  const now = Date.now();
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiresAt: now + r.expires_in * 1000,
    refreshExpiresAt: r.refresh_token_expires_in ? now + r.refresh_token_expires_in * 1000 : undefined,
    scope: r.scope,
  };
}
