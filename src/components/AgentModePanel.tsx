"use client";

// Autonomous mode control. One tap (from the connected browser) copies the
// operator's LinkedIn token into the server store, so scheduled jobs / agent code
// can manage campaigns without the browser. Shows health + a disable switch.

import { useCallback, useEffect, useState } from "react";
import { Card, Chip } from "./ui";

type Health = { enabled: boolean; expiresInDays?: number; canRefresh?: boolean; scopes?: string[] };

export function AgentModePanel() {
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/linkedin/agent", { cache: "no-store" });
      const d = await r.json();
      setHealth(d.autonomous ?? null);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function toggle(enable: boolean) {
    if (!enable && typeof window !== "undefined" && !window.confirm("Turn off autonomous mode? Scheduled management will stop.")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/linkedin/agent", { method: enable ? "POST" : "DELETE" });
      const d = await r.json();
      if (!r.ok || d.error) setError(String(d.error ?? `failed (${r.status})`));
      else setHealth(d.autonomous ?? (enable ? { enabled: true } : { enabled: false }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const on = health?.enabled;

  return (
    <Card title="Autonomous mode" subtitle="Let me manage campaigns without your browser" className="!p-4">
      <div className="flex items-center gap-2">
        <Chip tone={on ? "green" : "zinc"}>{loading ? "…" : on ? "ON" : "OFF"}</Chip>
        {on && health?.expiresInDays != null && (
          <span className="text-xs text-zinc-500">
            token valid ~{health.expiresInDays}d ·{" "}
            {health.canRefresh ? <span className="text-green-700">auto-refresh ✓</span> : <span className="text-amber-700">no refresh — re-enable before expiry</span>}
          </span>
        )}
      </div>

      <p className="mt-3 text-[13px] leading-snug text-zinc-600">
        This copies your LinkedIn login into the encrypted server store (Supabase) <strong>once</strong>. After that, scheduled jobs and
        agent code read live performance and manage campaigns — pause weak creatives, shift budget — with no browser open. Spend
        increases and new campaigns still need your OK.
      </p>

      {error && <div className="mt-2 text-[13px] text-amber-700">Couldn’t update: {error}</div>}

      <div className="mt-3 flex gap-2">
        {!on ? (
          <button
            onClick={() => toggle(true)}
            disabled={busy}
            className="inline-flex h-10 items-center bg-indigo-600 px-4 text-sm font-medium text-white active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? "Enabling…" : "Enable autonomous mode"}
          </button>
        ) : (
          <button
            onClick={() => toggle(false)}
            disabled={busy}
            className="inline-flex h-10 items-center border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? "…" : "Disable"}
          </button>
        )}
      </div>
    </Card>
  );
}
