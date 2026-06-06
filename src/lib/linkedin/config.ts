// LinkedIn Marketing API configuration.
// Secrets are read from env (set these in Vercel project settings, and in
// .env.local for local dev — see docs/LINKEDIN.md). Nothing here is committed.

function ym(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthsAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - n);
  return ym(d);
}
// LinkedIn keeps only ~12 monthly versions (YYYYMM) active, so a hardcoded value
// goes stale (NONEXISTENT_VERSION). Accept an explicit LINKEDIN_API_VERSION only
// if it's recent enough; otherwise (unset / malformed / older than ~12 months)
// fall back to a recent active version (2 months back — released & in-window).
function resolveVersion(envVal: string | undefined): string {
  const recent = monthsAgo(2);
  const floor = monthsAgo(13);
  const now = ym(new Date());
  const m = envVal?.match(/\d{6}/)?.[0]; // normalize e.g. "20241101" -> "202411"
  return m && m >= floor && m <= now ? m : recent;
}

export const LINKEDIN = {
  authBase: "https://www.linkedin.com/oauth/v2",
  apiBase: "https://api.linkedin.com/rest",
  /** Versioned REST API (YYYYMM). Self-correcting so it can't go stale. */
  version: resolveVersion(process.env.LINKEDIN_API_VERSION),
  restliVersion: "2.0.0",
  /** Scopes: read ads, write ads (create campaigns), reporting, basic profile. */
  scopes: ["r_ads", "rw_ads", "r_ads_reporting", "r_basicprofile"],
} as const;

// Default ad account, so the user never has to enter it. Override with the
// LINKEDIN_AD_ACCOUNT_ID env var.
export const DEFAULT_AD_ACCOUNT_ID = process.env.LINKEDIN_AD_ACCOUNT_ID || "510931916";
export const DEFAULT_AD_ACCOUNT_URN = `urn:li:sponsoredAccount:${DEFAULT_AD_ACCOUNT_ID}`;

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
