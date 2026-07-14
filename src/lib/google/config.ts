// Google APIs configuration: GA4 (read), Tag Manager (read + write),
// Search Console (read). Secrets come from env — see docs/GOOGLE.md. Reuses
// TOKEN_ENC_KEY (already set for LinkedIn) to encrypt the token cookie.

export const GOOGLE = {
  authBase: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  // Per-API bases (each Google API is a different host).
  ga4Base: "https://analyticsdata.googleapis.com/v1beta",
  gaAdminBase: "https://analyticsadmin.googleapis.com/v1beta",
  gtmBase: "https://tagmanager.googleapis.com/tagmanager/v2",
  searchConsoleBase: "https://searchconsole.googleapis.com/webmasters/v3",
  /**
   * Least-privilege scopes:
   * - analytics.readonly            → GA4 Data API (funnel truth)
   * - tagmanager.readonly           → read GTM containers/tags/triggers
   * - tagmanager.edit.containers    → create/update tags, triggers, variables
   * - tagmanager.edit.containerversions → create container versions
   * - tagmanager.publish            → publish a version live
   * - webmasters.readonly           → Search Console (organic context)
   * - openid, email                 → identify the connected Google account
   */
  scopes: [
    "openid",
    "email",
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/tagmanager.readonly",
    "https://www.googleapis.com/auth/tagmanager.edit.containers",
    "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
    "https://www.googleapis.com/auth/tagmanager.publish",
    "https://www.googleapis.com/auth/webmasters.readonly",
  ],
} as const;

export interface GoogleEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encKey: string;
}

/** Returns config or a list of missing env var names. */
export function getGoogleEnv(): { env?: GoogleEnv; missing: string[] } {
  const pairs: [keyof GoogleEnv, string | undefined][] = [
    ["clientId", process.env.GOOGLE_CLIENT_ID],
    ["clientSecret", process.env.GOOGLE_CLIENT_SECRET],
    ["redirectUri", process.env.GOOGLE_REDIRECT_URI],
    ["encKey", process.env.TOKEN_ENC_KEY],
  ];
  const missing = pairs.filter(([, v]) => !v).map(([k]) => envName(k));
  if (missing.length) return { missing };
  const [clientId, clientSecret, redirectUri, encKey] = pairs.map(([, v]) => v as string);
  return { env: { clientId, clientSecret, redirectUri, encKey }, missing: [] };
}

function envName(k: keyof GoogleEnv): string {
  return {
    clientId: "GOOGLE_CLIENT_ID",
    clientSecret: "GOOGLE_CLIENT_SECRET",
    redirectUri: "GOOGLE_REDIRECT_URI",
    encKey: "TOKEN_ENC_KEY",
  }[k];
}

// Optional defaults (all discoverable via the APIs; override via env if you
// want to pin them). Empty string means "discover / caller must supply".
export const DEFAULT_GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || "";
export const DEFAULT_GTM_ACCOUNT_ID = process.env.GTM_ACCOUNT_ID || "";
export const DEFAULT_GTM_CONTAINER_ID = process.env.GTM_CONTAINER_ID || "";
export const DEFAULT_SC_SITE_URL = process.env.SC_SITE_URL || "";

// The LinkedIn Insight Tag partner id for this account (from the live
// /api/linkedin/insight-tag read). Used when deploying/repairing the tag in GTM.
export const LINKEDIN_INSIGHT_PARTNER_ID = process.env.LINKEDIN_INSIGHT_PARTNER_ID || "5552676";
