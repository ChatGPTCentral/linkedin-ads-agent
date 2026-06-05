"use client";

import { useState } from "react";
import type { IcpDistributions, GeoItem, DistributionItem } from "@/types";
import { BarList, cn, type BarItem } from "./ui";
import { usd } from "@/lib/format";

const DIMENSIONS = [
  { key: "geo", label: "Geography" },
  { key: "seniority", label: "Seniority" },
  { key: "goals", label: "Goals" },
  { key: "industry", label: "Industry" },
  { key: "contentPrefs", label: "Content" },
  { key: "personaMix", label: "Personas" },
] as const;

type DimKey = (typeof DIMENSIONS)[number]["key"];

const INSIGHTS: Record<DimKey, string> = {
  geo: "The US is 53% of converters. High-LTV markets (Switzerland $60, Israel $62, Portugal $66) punch above their weight; India ($24) and Brazil ($32) are high-volume but low-value — exclude them from high-CPM campaigns.",
  seniority: "Individual contributors lead by count, but founders + C-suite are a third of those reporting a level — and managers convert at the highest LTV ($58).",
  goals: "“Develop AI products/workflows” is the biggest, best-converting goal; “Train my team on AI” also converts strongly; “Prompt engineering” drives the highest LTV.",
  industry: "Directional only (small sample): agencies/consulting lead; Finance/Fintech shows the highest LTV.",
  contentPrefs: "Broad appetite — but how-to tutorials, prompt packs and tool comparisons recur most. Great fuel for creative and lead magnets.",
  personaMix: "Pipeline classification skews to decision-makers, then makers and operators — matching the three personas.",
};

export function IcpExplorer({ icp }: { icp: IcpDistributions }) {
  const [dim, setDim] = useState<DimKey>("geo");
  const [byLtv, setByLtv] = useState(false);
  const [tier, setTier] = useState<"all" | "tier1" | "western" | "emerging">("all");

  const base: DistributionItem[] = icp[dim];
  let items = base;
  if (dim === "geo" && tier !== "all") {
    items = (base as GeoItem[]).filter((g) => g.tier === tier);
  }

  const supportsLtv = items.some((i) => i.avgLtv != null);
  const sorted = [...items];
  if (byLtv && supportsLtv) sorted.sort((a, b) => (b.avgLtv ?? 0) - (a.avgLtv ?? 0));

  const barItems: BarItem[] = sorted.map((it) => {
    const showLtv = byLtv && supportsLtv;
    return {
      label: it.label + (it.smallSample ? " ·" : ""),
      value: showLtv ? it.avgLtv ?? 0 : it.count,
      right: showLtv ? (it.avgLtv != null ? usd(it.avgLtv, { cents: true }) : "—") : `${it.count}`,
      sub: showLtv
        ? `${it.count} ppl`
        : `${it.pct}%${it.avgLtv != null ? ` · ${usd(it.avgLtv)} LTV` : ""}${it.convRate != null ? ` · ${it.convRate}% conv` : ""}`,
      muted: it.smallSample,
    };
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {DIMENSIONS.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => {
              setDim(d.key);
              setByLtv(false);
              setTier("all");
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              dim === d.key ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            )}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-zinc-200">
          <button
            type="button"
            onClick={() => setByLtv(false)}
            className={cn("px-3 py-1 text-xs font-medium", !byLtv ? "bg-zinc-900 text-white" : "bg-white text-zinc-600")}
          >
            By volume
          </button>
          <button
            type="button"
            disabled={!supportsLtv}
            onClick={() => setByLtv(true)}
            className={cn(
              "px-3 py-1 text-xs font-medium",
              byLtv ? "bg-zinc-900 text-white" : "bg-white text-zinc-600",
              !supportsLtv && "cursor-not-allowed opacity-40"
            )}
          >
            By avg LTV
          </button>
        </div>

        {dim === "geo" && (
          <div className="inline-flex overflow-hidden rounded-md border border-zinc-200">
            {(["all", "tier1", "western", "emerging"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                className={cn("px-3 py-1 text-xs font-medium", tier === t ? "bg-indigo-600 text-white" : "bg-white text-zinc-600")}
              >
                {t === "all" ? "All" : t === "tier1" ? "Tier-1 English" : t === "western" ? "Western" : "Emerging"}
              </button>
            ))}
          </div>
        )}
      </div>

      <BarList items={barItems} accent={byLtv ? "bg-violet-500" : "bg-indigo-500"} />

      <p className="mt-4 border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-500">{INSIGHTS[dim]}</p>
    </div>
  );
}
