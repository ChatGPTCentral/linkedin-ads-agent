import { NextRequest, NextResponse } from "next/server";
import { getValidToken, liGet } from "@/lib/linkedin/client";
import { DEFAULT_AD_ACCOUNT_URN } from "@/lib/linkedin/config";
import { AUDIENCES } from "@/data/linkedin";
import { resolveAudienceFacets, resolveExcludedLocations, buildTargetingCriteria } from "@/lib/linkedin/targeting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { audienceId, adAccountUrn } = (await req.json()) as { audienceId?: string; adAccountUrn?: string };
  const audience = AUDIENCES.find((a) => a.id === audienceId);
  if (!audience) return NextResponse.json({ error: "unknown_audience" }, { status: 400 });

  const t = await getValidToken();
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 401 });

  const include = await resolveAudienceFacets(audience, t.accessToken);
  const exclude = await resolveExcludedLocations(audience, t.accessToken);
  const criteria = buildTargetingCriteria(include, exclude);

  // Audience Counts API. The exact query encoding is version-specific; we return
  // the resolved facets + criteria + raw response so we can tune it once live.
  const account = adAccountUrn || DEFAULT_AD_ACCOUNT_URN;
  const params =
    `q=targetingCriteria&targetingCriteria=${encodeURIComponent(JSON.stringify(criteria))}` +
    `&account=${encodeURIComponent(account)}`;
  let result: unknown;
  try {
    const res = await liGet(`/audienceCounts?${params}`, t.accessToken);
    result = res.ok ? await res.json() : { status: res.status, error: (await res.text()).slice(0, 600) };
  } catch (e) {
    result = { error: (e as Error).message };
  }

  return NextResponse.json({
    audienceId,
    resolvedFacets: include,
    excludedLocations: exclude,
    unresolved: include.flatMap((f) => f.unresolved ?? []),
    targetingCriteria: criteria,
    result,
  });
}
