import { NextResponse } from "next/server";
import { getValidToken, liGet } from "@/lib/linkedin/client";
import { DEFAULT_AD_ACCOUNT_URN, getLinkedInEnv } from "@/lib/linkedin/config";
import { readStoredToken } from "@/lib/linkedin/tokenStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const t = await getValidToken();
  if ("error" in t) return NextResponse.json({ connected: false, reason: t.error });

  // Surface the granted scopes on the current token so the operator can see, at a
  // glance, exactly what this connection can do — e.g. whether rw_dmp_segments
  // (Matched Audiences / retargeting) is present — without digging in the portal.
  let scopes: string[] = [];
  try {
    const { env } = getLinkedInEnv();
    if (env) {
      const tok = await readStoredToken(env.encKey);
      scopes = (tok?.scope ?? "").split(/[\s,]+/).filter(Boolean).sort();
    }
  } catch {
    /* non-fatal */
  }
  const has = (s: string) => scopes.includes(s);
  const capabilities = {
    readAds: has("r_ads"),
    manageAds: has("rw_ads"),
    reporting: has("r_ads_reporting"),
    conversions: has("rw_conversions"), // conversion tracking (done)
    matchedAudiences: has("rw_dmp_segments"), // retargeting — separate scope
    orgPages: has("r_organization_admin") || has("r_organization_social"),
  };

  let accounts: unknown = null;
  try {
    const res = await liGet("/adAccounts?q=search", t.accessToken);
    accounts = res.ok ? await res.json() : { status: res.status, error: (await res.text()).slice(0, 400) };
  } catch (e) {
    accounts = { error: (e as Error).message };
  }
  return NextResponse.json({ connected: true, scopes, capabilities, accounts, defaultAccountUrn: DEFAULT_AD_ACCOUNT_URN });
}
