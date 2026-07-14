import { NextResponse } from "next/server";
import { getValidGoogleToken, gGet } from "@/lib/google/client";
import { GOOGLE } from "@/lib/google/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Fetched {
  ok: boolean;
  status?: number;
  data?: unknown;
  error?: string;
}

async function pull(url: string, token: string): Promise<Fetched> {
  try {
    const r = await gGet(url, token);
    const text = await r.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 300) };
    }
    return r.ok ? { ok: true, data } : { ok: false, status: r.status, error: text.slice(0, 300) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// GET: confirm the Google connection and discover which GA4 properties, GTM
// accounts/containers, and Search Console sites this account can reach — so the
// operator can point the funnel tools at the right thecentral.ai resources.
export async function GET() {
  const t = await getValidGoogleToken();
  if ("error" in t) return NextResponse.json({ connected: false, reason: t.error });
  const token = t.accessToken;

  const [gaSum, gtmAcc, scSites] = await Promise.all([
    pull(`${GOOGLE.gaAdminBase}/accountSummaries`, token),
    pull(`${GOOGLE.gtmBase}/accounts`, token),
    pull(`${GOOGLE.searchConsoleBase}/sites`, token),
  ]);

  const ga4Properties = gaSum.ok
    ? ((gaSum.data as { accountSummaries?: Array<{ displayName?: string; propertySummaries?: Array<{ property?: string; displayName?: string }> }> }).accountSummaries ?? [])
        .flatMap((a) =>
          (a.propertySummaries ?? []).map((p) => ({
            property: p.property, // "properties/123456789"
            propertyId: p.property?.split("/").pop() ?? null,
            displayName: p.displayName,
            account: a.displayName,
          }))
        )
    : { error: gaSum.error, status: gaSum.status };

  let gtmAccounts: unknown;
  if (gtmAcc.ok) {
    const accounts = (gtmAcc.data as { account?: Array<{ accountId?: string; name?: string }> }).account ?? [];
    gtmAccounts = await Promise.all(
      accounts.map(async (a) => {
        const cont = await pull(`${GOOGLE.gtmBase}/accounts/${a.accountId}/containers`, token);
        const containers = cont.ok
          ? ((cont.data as { container?: Array<{ containerId?: string; name?: string; publicId?: string; usageContext?: string[] }> }).container ?? [])
              .map((c) => ({ containerId: c.containerId, name: c.name, publicId: c.publicId, usageContext: c.usageContext }))
          : { error: cont.error, status: cont.status };
        return { accountId: a.accountId, name: a.name, containers };
      })
    );
  } else {
    gtmAccounts = { error: gtmAcc.error, status: gtmAcc.status };
  }

  const searchConsoleSites = scSites.ok
    ? ((scSites.data as { siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }> }).siteEntry ?? [])
        .map((s) => ({ siteUrl: s.siteUrl, permissionLevel: s.permissionLevel }))
    : { error: scSites.error, status: scSites.status };

  return NextResponse.json({ connected: true, ga4Properties, gtmAccounts, searchConsoleSites });
}
