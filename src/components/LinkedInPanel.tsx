"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Chip, cn } from "./ui";

type AudienceLite = { id: string; name: string; copyId?: string };
type Status = { connected: boolean; reason?: string; accounts?: unknown };

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

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/linkedin/status");
      setStatus(await r.json());
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
                    onClick={() => post("/api/linkedin/campaigns", { audienceId: a.id, copyId: a.copyId, adAccountUrn: acct }, `create-${a.id}`, a.id)}
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
    </div>
  );
}
