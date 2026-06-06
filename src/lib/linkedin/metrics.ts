import { AVG_LTV_USD } from "./config";

interface AnalyticsElement {
  costInUsd?: string | number;
  externalWebsiteConversions?: number;
  conversionValueInLocalCurrency?: string | number;
  clicks?: number;
  impressions?: number;
  pivotValues?: string[];
}

export interface CampaignMetric {
  campaign: string | null;
  spend: number;
  conversions: number;
  clicks: number;
  impressions: number;
  cpa: number | null;
  revenue: number;
  roas: number | null;
}

function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Compute per-campaign spend / conversions / CPA / ROAS from adAnalytics
 * elements. Revenue uses LinkedIn's conversion value when present, otherwise
 * falls back to (conversions × avg LTV) — in which case roasEstimated is true.
 */
export function computeMetrics(elementsRaw: unknown[]): {
  computed: CampaignMetric[];
  totals: { spend: number; conversions: number; revenue: number; cpa: number | null; roas: number | null };
  roasEstimated: boolean;
  valueSource: string;
} {
  const elements = elementsRaw as AnalyticsElement[];
  let anyValue = false;
  const computed: CampaignMetric[] = elements.map((e) => {
    const spend = num(e.costInUsd);
    const conversions = num(e.externalWebsiteConversions);
    const hasValue = e.conversionValueInLocalCurrency != null;
    if (hasValue) anyValue = true;
    const revenue = hasValue ? num(e.conversionValueInLocalCurrency) : conversions * AVG_LTV_USD;
    return {
      campaign: e.pivotValues?.[0] ?? null,
      spend,
      conversions,
      clicks: num(e.clicks),
      impressions: num(e.impressions),
      cpa: conversions > 0 ? spend / conversions : null,
      revenue,
      roas: spend > 0 ? revenue / spend : null,
    };
  });
  const spend = computed.reduce((s, c) => s + c.spend, 0);
  const conversions = computed.reduce((s, c) => s + c.conversions, 0);
  const revenue = computed.reduce((s, c) => s + c.revenue, 0);
  return {
    computed,
    totals: {
      spend,
      conversions,
      revenue,
      cpa: conversions > 0 ? spend / conversions : null,
      roas: spend > 0 ? revenue / spend : null,
    },
    roasEstimated: !anyValue,
    valueSource: anyValue ? "linkedin_conversion_value" : `estimated_avg_ltv_${AVG_LTV_USD}`,
  };
}
