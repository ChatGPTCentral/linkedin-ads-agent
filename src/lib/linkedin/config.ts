// LinkedIn Marketing API configuration.
// Secrets are read from env (set these in Vercel project settings, and in
// .env.local for local dev — see docs/LINKEDIN.md). Nothing here is committed.

export const LINKEDIN = {
  authBase: "https://www.linkedin.com/oauth/v2",
  apiBase: "https://api.linkedin.com/rest",
  /** Versioned REST API — bump as LinkedIn releases new versions (YYYYMM). */
  version: process.env.LINKEDIN_API_VERSION || "202411",
  restliVersion: "2.0.0",
  /** Scopes: read ads, write ads (create campaigns), reporting, basic profile. */
  scopes: ["r_ads", "rw_ads", "r_ads_reporting", "r_basicprofile"],
} as const;

export interface LinkedInEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encKey: string;
}

/** Returns config or a list of missing env var names. */
export function getLinkedInEnv(): { env?: LinkedInEnv; missing: string[] } {
  const pairs: [keyof LinkedInEnv, string | undefined][] = [
    ["clientId", process.env.LINKEDIN_CLIENT_ID],
    ["clientSecret", process.env.LINKEDIN_CLIENT_SECRET],
    ["redirectUri", process.env.LINKEDIN_REDIRECT_URI],
    ["encKey", process.env.TOKEN_ENC_KEY],
  ];
  const missing = pairs.filter(([, v]) => !v).map(([k]) => envName(k));
  if (missing.length) return { missing };
  const [clientId, clientSecret, redirectUri, encKey] = pairs.map(([, v]) => v as string);
  return { env: { clientId, clientSecret, redirectUri, encKey }, missing: [] };
}

function envName(k: keyof LinkedInEnv): string {
  return {
    clientId: "LINKEDIN_CLIENT_ID",
    clientSecret: "LINKEDIN_CLIENT_SECRET",
    redirectUri: "LINKEDIN_REDIRECT_URI",
    encKey: "TOKEN_ENC_KEY",
  }[k];
}
