import crypto from "node:crypto";
import { LINKEDIN, type LinkedInEnv } from "./config";
import type { LinkedInTokenResponse, StoredToken } from "./types";

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

// --- Stateless signed CSRF state (no cookie needed) --------------------------
// state = base64url(payload) + "." + base64url(HMAC-SHA256(encKey, payload)),
// where payload = `${timestamp}.${nonce}`. Verified by recomputing the HMAC, so
// forgery is infeasible without the secret and nothing is stored — Vercel
// Deployment Protection can't break it by stripping cookies.
export function makeState(encKey: string): string {
  const payload = `${Date.now()}.${crypto.randomBytes(9).toString("base64url")}`;
  const sig = crypto.createHmac("sha256", encKey).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyState(encKey: string, state: string | null, maxAgeMs = 600_000): boolean {
  if (!state) return false;
  const dot = state.lastIndexOf(".");
  if (dot < 1) return false;
  let payload: string;
  try {
    payload = Buffer.from(state.slice(0, dot), "base64url").toString("utf8");
  } catch {
    return false;
  }
  const expected = crypto.createHmac("sha256", encKey).update(payload).digest("base64url");
  const a = Buffer.from(state.slice(dot + 1));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const ts = Number(payload.split(".")[0]);
  return Number.isFinite(ts) && Date.now() - ts <= maxAgeMs && ts <= Date.now() + 60_000;
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
