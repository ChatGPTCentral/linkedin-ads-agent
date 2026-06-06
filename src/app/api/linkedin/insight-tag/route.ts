import { NextRequest, NextResponse } from "next/server";
import { getValidToken, liGet } from "@/lib/linkedin/client";
import { DEFAULT_AD_ACCOUNT_URN } from "@/lib/linkedin/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface InsightTag {
  id?: number | string;
  account?: string;
  firstPartyTrackingEnabled?: boolean;
  snippet?: string;
}

/** Build the standard LinkedIn Insight Tag snippet from a partner id. */
function snippetFor(partnerId: string): string {
  return [
    `<script type="text/javascript">`,
    `_linkedin_partner_id = "${partnerId}";`,
    `window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];`,
    `window._linkedin_data_partner_ids.push(_linkedin_partner_id);`,
    `</script>`,
    `<script type="text/javascript">`,
    `(function(l) {`,
    `  if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}`,
    `  var s = document.getElementsByTagName("script")[0];`,
    `  var b = document.createElement("script");`,
    `  b.type = "text/javascript";b.async = true;`,
    `  b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";`,
    `  s.parentNode.insertBefore(b, s);})(window.lintrk);`,
    `</script>`,
    `<noscript>`,
    `  <img height="1" width="1" style="display:none;" alt="" src="https://px.ads.linkedin.com/collect/?pid=${partnerId}&fmt=gif" />`,
    `</noscript>`,
  ].join("\n");
}

// GET: fetch the account's LinkedIn Insight Tag partner id + install snippet.
// The Insight Tag must already exist on the account; this does not create one.
export async function GET(req: NextRequest) {
  const account = req.nextUrl.searchParams.get("account") || DEFAULT_AD_ACCOUNT_URN;
  const t = await getValidToken();
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 401 });

  const res = await liGet(`/insightTags?q=account&account=${encodeURIComponent(account)}`, t.accessToken);
  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json(
      {
        step: "list",
        status: res.status,
        error: text.slice(0, 600),
        hint: "If this fails, copy the Partner ID from Campaign Manager → Analyze → Insight Tag → Manage Insight Tag, then paste the base tag on your landing page.",
      },
      { status: 502 }
    );
  }

  let tags: InsightTag[] = [];
  try {
    tags = (JSON.parse(text) as { elements?: InsightTag[] }).elements ?? [];
  } catch {
    /* leave empty if the body isn't the expected shape */
  }
  const first = tags[0];
  const partnerId = first?.id != null ? String(first.id) : null;
  return NextResponse.json({
    ok: true,
    account,
    partnerId,
    firstPartyTrackingEnabled: first?.firstPartyTrackingEnabled ?? null,
    snippet: partnerId ? snippetFor(partnerId) : (first?.snippet ?? null),
    verify:
      "Paste the snippet into your landing page <head> (Next.js: next/script strategy=\"afterInteractive\"). Then confirm status shows Active in Campaign Manager → Insight Tag — the first signal can take ~24h.",
  });
}
