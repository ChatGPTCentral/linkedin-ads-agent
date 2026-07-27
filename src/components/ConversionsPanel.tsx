"use client";

// Conversions panel — reads the ad account's conversion rules (needs the
// rw_conversions scope on the operator's LinkedIn token) so you can confirm at a
// glance that "Quiz Completed" and "Purchase — Stripe (CAPI)" are live and
// enabled. Self-fetching + cookie-bound, like the rest of the cockpit.

import { useCallback, useEffect, useState } from "react";
import { Card, Chip } from "./ui";

const ACCOUNT = "urn:li:sponsoredAccount:510931916";
const REFRESH_MS = 120_000;

// The two rules that matter to the funnel loop (from the plan).
const OPTIMIZE_ID = "27150700"; // Quiz Completed — the mid-funnel optimization signal
const REVENUE_ID = "27150724"; // Purchase — Stripe (CAPI) — the money conversion

type Conversion = {
  id: number | string | null;
  urn: string | null;
  name: string | null;
  type: string | null;
  enabled: boolean | null;
};

function tagFor(c: Conversion): { label: string; tone: "indigo" | "green" } | null {
  const id = String(c.id ?? "");
  const n = (c.name ?? "").toLowerCase();
  if (id === OPTIMIZE_ID || n.includes("quiz completed")) return { label: "optimize target", tone: "indigo" };
  if (id === REVENUE_ID || n.includes("capi") || (n.includes("purchase") && n.includes("stripe"))) return { label: "revenue", tone: "green" };
  return null;
}

export function ConversionsPanel() {
  const [rows, setRows] = useState<Conversion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/linkedin/conversions?account=${encodeURIComponent(ACCOUNT)}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok || d.error) {
        setStatus(r.status);
        setError(String(d.error ?? d.step ?? "could not load conversions"));
        setRows(null);
      } else {
        setError(null);
        // Enabled first, then by name.
        const list: Conversion[] = (d.conversions ?? []).slice().sort((a: Conversion, b: Conversion) => {
          const ae = a.enabled ? 0 : 1;
          const be = b.enabled ? 0 : 1;
          return ae - be || String(a.name ?? "").localeCompare(String(b.name ?? ""));
        });
        setRows(list);
      }
    } catch (e) {
      setError((e as Error).message);
      setRows(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  // Don't render an empty box before the first load resolves.
  if (loading && !rows && !error) {
    return (
      <Card title="Conversions" subtitle="Tracking rules on this ad account" className="!p-4">
        <div className="py-6 text-center text-sm text-zinc-400">Loading conversions…</div>
      </Card>
    );
  }

  const scopeIssue = status === 401 || status === 403 || (error ?? "").toLowerCase().includes("scope");

  return (
    <Card title="Conversions" subtitle="Tracking rules on this ad account" className="!p-4">
      {error && (
        <div className="text-[13px] leading-snug text-amber-700">
          {scopeIssue
            ? "Can’t read conversions yet — reconnect LinkedIn (Connections → Disconnect → Connect) and approve “manage your conversion tracking data” (rw_conversions)."
            : `Couldn’t load conversions (${error}).`}
        </div>
      )}

      {rows && rows.length === 0 && <div className="py-4 text-center text-sm text-zinc-400">No conversion rules on this account.</div>}

      {rows && rows.length > 0 && (
        <div className="divide-y divide-zinc-100">
          {rows.map((c, i) => {
            const tag = tagFor(c);
            return (
              <div key={i} className="flex items-center gap-2 py-2 text-sm">
                <Chip tone={c.enabled ? "green" : "zinc"}>{c.enabled ? "on" : "off"}</Chip>
                <span className="min-w-0 flex-1 truncate font-medium text-zinc-800">{c.name ?? `#${c.id ?? "?"}`}</span>
                {tag && <Chip tone={tag.tone}>{tag.label}</Chip>}
                <span className="hidden shrink-0 text-[11px] uppercase tracking-wide text-zinc-400 sm:inline">
                  {(c.type ?? "").replace(/_/g, " ").toLowerCase()}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 border-t border-zinc-100 pt-2 text-[11px] text-zinc-400">
        <span className="text-indigo-600">optimize target</span> = the conversion LinkedIn should bid toward (Quiz Completed);{" "}
        <span className="text-green-700">revenue</span> = the purchase conversion fed by Stripe (CAPI). Both should read “on”.
      </p>
    </Card>
  );
}
