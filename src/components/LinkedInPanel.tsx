"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Chip, cn } from "./ui";

type AudienceLite = { id: string; name: string; copyId?: string };
type Status = { connected: boolean; reason?: string; accounts?: unknown; defaultAccountUrn?: string };
type ConvOpt = { urn: string; name: string };
type PerfRow = { campaign: string | null; spend: number; conversions: number; cpa: number | null; roas: number | null };
type PerfData = {
  computed: PerfRow[];
  totals: { spend: number; conversions: number; cpa: number | null; roas: number | null };
  roasEstimated: boolean;
};

function extractAccounts(accounts: unknown): { urn: string; label: string }[] {
  if (!accounts || typeof accounts !== "object") return [];
  const els = (accounts as { elements?: unknown }).elements;
  if (!Array.isArray(els)) return [];
  return els
    .map((e) => {
      const o = e as { id?: number | string; name?: string };
      if (o.id == null) return null;
      return { urn: `urn:li:sponsoredAccount:${o.id}`, label: o.name ? `${o.name} (${o.id})` : String(o.id) };
    })
    .filter((x): x is { urn: string; label: string } => x !== null);
}

export function LinkedInPanel({ audiences }: { audiences: AudienceLite[] }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [acct, setAcct] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [out, setOut] = useState<Record<string, string>>({});
  const [savedBusy, setSavedBusy] = useState<string | null>(null);
  const [savedOut, setSavedOut] = useState<string>("");
  const [audName, setAudName] = useState("");
  const [audEmails, setAudEmails] = useState("");
  const [igBusy, setIgBusy] = useState<string | null>(null);
  const [igOut, setIgOut] = useState("");
  const [convs, setConvs] = useState<ConvOpt[]>([]);
  const [convUrn, setConvUrn] = useState("");
  const [objective, setObjective] = useState<"WEBSITE_CONVERSION" | "WEBSITE_VISIT">("WEBSITE_CONVERSION");
  const [perf, setPerf] = useState<PerfData | null>(null);
  const [perfErr, setPerfErr] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/linkedin/status");
      const data: Status = await r.json();
      setStatus(data);
      if (data.defaultAccountUrn) setAcct((cur) => cur || data.defaultAccountUrn!);
    } catch (e) {
      setStatus({ connected: false, reason: (e as Error).message });
    }
  }, []);
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function post(path: string, body: unknown, key: string, audId: string) {
    setBusy(key);
    try {
      const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json();
      setOut((o) => ({ ...o, [audId]: JSON.stringify(data, null, 2) }));
    } catch (e) {
      setOut((o) => ({ ...o, [audId]: String(e) }));
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    await fetch("/api/linkedin/disconnect", { method: "POST" });
    setStatus(null);
    loadStatus();
  }

  async function loadSaved() {
    setSavedBusy("load");
    try {
      const r = await fetch(`/api/linkedin/audiences?account=${encodeURIComponent(acct)}`);
      setSavedOut(JSON.stringify(await r.json(), null, 2));
    } catch (e) {
      setSavedOut(String(e));
    } finally {
      setSavedBusy(null);
    }
  }

  async function createList() {
    setSavedBusy("create");
    try {
      const emails = audEmails.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
      const r = await fetch("/api/linkedin/audiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: audName, emails, account: acct || undefined }),
      });
      setSavedOut(JSON.stringify(await r.json(), null, 2));
    } catch (e) {
      setSavedOut(String(e));
    } finally {
      setSavedBusy(null);
    }
  }

  async function loadInsightTag() {
    setIgBusy("tag");
    try {
      const r = await fetch(`/api/linkedin/insight-tag?account=${encodeURIComponent(acct)}`);
      setIgOut(JSON.stringify(await r.json(), null, 2));
    } catch (e) {
      setIgOut(String(e));
    } finally {
      setIgBusy(null);
    }
  }

  async function loadConversions() {
    setIgBusy("listConv");
    try {
      const r = await fetch(`/api/linkedin/conversions?account=${encodeURIComponent(acct)}`);
      const data = await r.json();
      setIgOut(JSON.stringify(data, null, 2));
      if (Array.isArray(data?.conversions)) {
        const list: ConvOpt[] = data.conversions
          .filter((c: { urn?: string }) => c.urn)
          .map((c: { urn: string; name?: string }) => ({ urn: c.urn, name: c.name ?? c.urn }));
        setConvs(list);
        setConvUrn((cur) => cur || list[0]?.urn || "");
      }
    } catch (e) {
      setIgOut(String(e));
    } finally {
      setIgBusy(null);
    }
  }

  async function createConversion(kind: "PURCHASE" | "SIGN_UP") {
    setIgBusy(kind);
    try {
      const r = await fetch("/api/linkedin/conversions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, account: acct || undefined }),
      });
      const data = await r.json();
      setIgOut(JSON.stringify(data, null, 2));
      if (data?.conversionUrn) {
        setConvUrn(data.conversionUrn);
        loadConversions();
      }
    } catch (e) {
      setIgOut(String(e));
    } finally {
      setIgBusy(null);
    }
  }

  async function loadPerf() {
    setIgBusy("perf");
    setPerfErr("");
    try {
      const r = await fetch(`/api/linkedin/analytics?account=${encodeURIComponent(acct)}`);
      const data = await r.json();
      if (data?.ok) setPerf(data as PerfData);
      else setPerfErr(JSON.stringify(data, null, 2));
    } catch (e) {
      setPerfErr(String(e));
    } finally {
      setIgBusy(null);
    }
  }

  const accounts = extractAccounts(status?.accounts);
  const missingConfig = status?.reason?.startsWith("missing_config");

  return (
    <div className="space-y-4">
      <Card title="Connection">
        {status === null ? (
          <p className="text-sm text-zinc-500">Checking connection…</p>
        ) : status.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Chip tone="green">Connected</Chip>
              <button onClick={disconnect} className="text-xs font-medium text-zinc-500 underline">
                Disconnect
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Ad account URN</label>
              <input
                value={acct}
                onChange={(e) => setAcct(e.target.value)}
                placeholder="urn:li:sponsoredAccount:123456789"
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-mono"
              />
              {accounts.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {accounts.map((a) => (
                    <button
                      key={a.urn}
                      onClick={() => setAcct(a.urn)}
                      className="rounded-md border border-zinc-200 px-2 py-0.5 text-xs hover:bg-zinc-50"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
              {status.accounts != null && accounts.length === 0 && (
                <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-zinc-50 p-2 text-[11px] text-zinc-600">
                  {JSON.stringify(status.accounts, null, 2)}
                </pre>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-zinc-600">
              Not connected{status.reason ? <> — <span className="font-mono text-xs">{status.reason}</span></> : null}.
            </p>
            {missingConfig ? (
              <p className="text-xs text-amber-700">
                Set the LinkedIn env vars (see <span className="font-mono">docs/LINKEDIN.md</span>) in Vercel, then redeploy and reconnect.
              </p>
            ) : (
              <a
                href="/api/linkedin/auth"
                className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Connect LinkedIn
              </a>
            )}
          </div>
        )}
      </Card>

      <Card title="Audiences" subtitle="Live reach pulls real LinkedIn audience size. Create makes a PAUSED draft campaign — never auto-launches spend.">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wide text-zinc-400">Optimize for</span>
          <select
            value={objective}
            onChange={(e) => setObjective(e.target.value as "WEBSITE_CONVERSION" | "WEBSITE_VISIT")}
            className="rounded-md border border-zinc-200 px-2 py-1"
          >
            <option value="WEBSITE_CONVERSION">Purchases (conversion)</option>
            <option value="WEBSITE_VISIT">Site visits (traffic)</option>
          </select>
          {objective === "WEBSITE_CONVERSION" && (
            <select
              value={convUrn}
              onChange={(e) => setConvUrn(e.target.value)}
              className="rounded-md border border-zinc-200 px-2 py-1"
            >
              <option value="">No conversion attached</option>
              {convs.map((c) => (
                <option key={c.urn} value={c.urn}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="space-y-3">
          {audiences.map((a) => (
            <div key={a.id} className="rounded-lg border border-zinc-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-900">{a.name}</span>
                <div className="flex gap-2">
                  <button
                    disabled={!status?.connected || busy !== null}
                    onClick={() => post("/api/linkedin/audience-counts", { audienceId: a.id, adAccountUrn: acct || undefined }, `reach-${a.id}`, a.id)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium",
                      status?.connected ? "border-zinc-200 hover:bg-zinc-50" : "border-zinc-100 text-zinc-300"
                    )}
                  >
                    {busy === `reach-${a.id}` ? "Loading…" : "Live reach"}
                  </button>
                  <button
                    disabled={!status?.connected || !acct || busy !== null}
                    onClick={() =>
                      post(
                        "/api/linkedin/campaigns",
                        {
                          audienceId: a.id,
                          copyId: a.copyId,
                          adAccountUrn: acct,
                          objective,
                          conversionUrn: objective === "WEBSITE_CONVERSION" ? convUrn || undefined : undefined,
                        },
                        `create-${a.id}`,
                        a.id
                      )
                    }
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium",
                      status?.connected && acct ? "bg-zinc-900 text-white hover:bg-zinc-800" : "bg-zinc-100 text-zinc-400"
                    )}
                  >
                    {busy === `create-${a.id}` ? "Creating…" : "Create draft campaign"}
                  </button>
                </div>
              </div>
              {out[a.id] && (
                <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-zinc-50 p-2 text-[11px] leading-relaxed text-zinc-700">{out[a.id]}</pre>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Conversion tracking (Insight Tag + conversions)"
        subtitle="Install the Insight Tag on your landing page, then create purchase / sign-up conversions so campaigns optimize for payers, not clicks."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              disabled={!status?.connected || igBusy !== null}
              onClick={loadInsightTag}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium",
                status?.connected ? "border-zinc-200 hover:bg-zinc-50" : "border-zinc-100 text-zinc-300"
              )}
            >
              {igBusy === "tag" ? "Loading…" : "Load Insight Tag"}
            </button>
            <button
              disabled={!status?.connected || igBusy !== null}
              onClick={() => createConversion("PURCHASE")}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium",
                status?.connected ? "border-zinc-200 hover:bg-zinc-50" : "border-zinc-100 text-zinc-300"
              )}
            >
              {igBusy === "PURCHASE" ? "Creating…" : "Create PURCHASE conversion"}
            </button>
            <button
              disabled={!status?.connected || igBusy !== null}
              onClick={() => createConversion("SIGN_UP")}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium",
                status?.connected ? "border-zinc-200 hover:bg-zinc-50" : "border-zinc-100 text-zinc-300"
              )}
            >
              {igBusy === "SIGN_UP" ? "Creating…" : "Create SIGN_UP conversion"}
            </button>
            <button
              disabled={!status?.connected || igBusy !== null}
              onClick={loadConversions}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium",
                status?.connected ? "border-zinc-200 hover:bg-zinc-50" : "border-zinc-100 text-zinc-300"
              )}
            >
              {igBusy === "listConv" ? "Loading…" : "List conversions"}
            </button>
          </div>
          {igOut && (
            <pre className="max-h-72 overflow-auto rounded-md bg-zinc-50 p-2 text-[11px] leading-relaxed text-zinc-700">{igOut}</pre>
          )}
        </div>
      </Card>

      <Card
        title="Performance (CPA / ROAS)"
        subtitle="Last 30 days by campaign. ROAS is estimated from avg LTV until LinkedIn returns per-conversion values."
      >
        <div className="space-y-3">
          <button
            disabled={!status?.connected || !acct || igBusy !== null}
            onClick={loadPerf}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium",
              status?.connected && acct ? "border-zinc-200 hover:bg-zinc-50" : "border-zinc-100 text-zinc-300"
            )}
          >
            {igBusy === "perf" ? "Loading…" : "Refresh analytics"}
          </button>
          {perf && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-zinc-400">
                    <th className="py-1 pr-3 font-medium">Campaign</th>
                    <th className="py-1 pr-3 text-right font-medium">Spend</th>
                    <th className="py-1 pr-3 text-right font-medium">Conv.</th>
                    <th className="py-1 pr-3 text-right font-medium">CPA</th>
                    <th className="py-1 text-right font-medium">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {perf.computed.map((r, i) => (
                    <tr key={i} className="border-t border-zinc-100">
                      <td className="py-1 pr-3 font-mono text-[11px] text-zinc-600">{r.campaign ?? "—"}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">${r.spend.toFixed(2)}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{r.conversions}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{r.cpa != null ? `$${r.cpa.toFixed(2)}` : "—"}</td>
                      <td className="py-1 text-right tabular-nums">{r.roas != null ? `${r.roas.toFixed(2)}×` : "—"}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-zinc-200 font-semibold">
                    <td className="py-1 pr-3">Total</td>
                    <td className="py-1 pr-3 text-right tabular-nums">${perf.totals.spend.toFixed(2)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{perf.totals.conversions}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{perf.totals.cpa != null ? `$${perf.totals.cpa.toFixed(2)}` : "—"}</td>
                    <td className="py-1 text-right tabular-nums">{perf.totals.roas != null ? `${perf.totals.roas.toFixed(2)}×` : "—"}</td>
                  </tr>
                </tbody>
              </table>
              {perf.roasEstimated && (
                <p className="mt-2 text-[11px] text-amber-700">ROAS estimated from avg LTV (no per-conversion value from LinkedIn yet).</p>
              )}
            </div>
          )}
          {perfErr && (
            <pre className="max-h-48 overflow-auto rounded-md bg-zinc-50 p-2 text-[11px] text-zinc-700">{perfErr}</pre>
          )}
        </div>
      </Card>

      <Card
        title="Saved audiences (Matched Audiences)"
        subtitle="Read your account's DMP segments, or create a list-based audience from emails. Needs the rw_dmp_segments scope — reconnect after deploy."
      >
        <div className="space-y-3">
          <button
            disabled={!status?.connected || savedBusy !== null}
            onClick={loadSaved}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium",
              status?.connected ? "border-zinc-200 hover:bg-zinc-50" : "border-zinc-100 text-zinc-300"
            )}
          >
            {savedBusy === "load" ? "Loading…" : "Load saved audiences"}
          </button>

          <div className="space-y-2 rounded-lg border border-zinc-200 p-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Create list audience</label>
            <input
              value={audName}
              onChange={(e) => setAudName(e.target.value)}
              placeholder="Audience name"
              className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm"
            />
            <textarea
              value={audEmails}
              onChange={(e) => setAudEmails(e.target.value)}
              rows={4}
              placeholder="Paste emails (comma, space or newline separated). Hashed before upload — raw emails never leave your server."
              className="w-full rounded-md border border-zinc-200 px-3 py-1.5 font-mono text-sm"
            />
            <button
              disabled={!status?.connected || !audName.trim() || savedBusy !== null}
              onClick={createList}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium",
                status?.connected && audName.trim() ? "bg-zinc-900 text-white hover:bg-zinc-800" : "bg-zinc-100 text-zinc-400"
              )}
            >
              {savedBusy === "create" ? "Creating…" : "Create list audience"}
            </button>
          </div>

          {savedOut && (
            <pre className="max-h-72 overflow-auto rounded-md bg-zinc-50 p-2 text-[11px] leading-relaxed text-zinc-700">{savedOut}</pre>
          )}
        </div>
      </Card>
    </div>
  );
}
