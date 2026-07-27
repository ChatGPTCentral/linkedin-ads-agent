"use client";

// One-tap creator for the conversion-optimized cold campaign. The LinkedIn write
// runs through /api/linkedin/campaigns using the operator's cookie token (so it
// must be tapped from the connected browser). It creates a PAUSED Website-
// Conversions campaign on the Core ICP, optimizing toward "Quiz Completed" —
// Audience Network off. Nothing spends until a creative is added + launched in
// Campaign Manager.

import { useState } from "react";
import { Card } from "./ui";

const QUIZ_COMPLETED_URN = "urn:li:conversion:27150700"; // Quiz Completed (LEAD) — optimization signal
const PURCHASE_CAPI_URN = "urn:li:conversion:27150724"; // Purchase — Stripe (CAPI) — track + learn toward buyers
const DEST_URL = "quiz.thecentral.ai/quiz-v2?utm_source=li_ads&utm_ref=cold";

type CreateResult = {
  ok?: boolean;
  created?: { campaignGroupUrn?: string | null; campaignUrn?: string | null };
  conversionAssociations?: { conversion: string; ok: boolean; status?: number; error?: string }[];
  objectiveType?: string;
};

export function CreateConversionCampaign() {
  const [budget, setBudget] = useState(25);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Create a PAUSED Quiz-optimized cold campaign at $${budget}/day?\n\nIt will NOT spend — you still add a creative + launch it in Campaign Manager.`
      )
    )
      return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/linkedin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audienceId: "core",
          objective: "WEBSITE_CONVERSION",
          conversionUrn: QUIZ_COMPLETED_URN, // optimize toward completions (has signal)
          conversionUrns: [PURCHASE_CAPI_URN], // + track/learn toward real buyers
          optimizationTargetType: "MAX_CONVERSION",
          dailyBudgetUsd: budget,
          name: "01 · COLD · Conversion (Quiz + Purchase)",
        }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        setError(String(d.error ?? d.step ?? `failed (${r.status})`));
        return;
      }
      setResult(d as CreateResult);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const campaignId = result?.created?.campaignUrn?.split(":").pop() ?? null;
  const convs = result?.conversionAssociations ?? [];
  const allConvOk = convs.length > 0 && convs.every((c) => c.ok);

  return (
    <Card title="Create Quiz-optimized campaign" subtitle="Optimizes for completions, not clicks" className="!p-4">
      {!result && (
        <>
          <p className="text-[13px] leading-snug text-zinc-600">
            Builds a <strong>PAUSED</strong> Website-Conversions campaign on your Core ICP. It <strong>optimizes toward Quiz
            Completed</strong> (the deepest signal with enough volume) and also <strong>tracks the Purchase (CAPI)</strong>{" "}
            conversion — so the moment real buyers appear, LinkedIn learns to chase buyer-lookalikes, not cheap clicks. Audience
            Network off. Nothing spends until you add a creative and launch in Campaign Manager.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <label className="text-xs text-zinc-500">
              Daily budget&nbsp;$
              <input
                type="number"
                min={10}
                step={5}
                value={budget}
                onChange={(e) => setBudget(Math.max(10, Number(e.target.value) || 10))}
                className="ml-1 w-20 border border-zinc-300 bg-white px-2 py-1 text-sm tabular-nums text-zinc-900"
              />
            </label>
            <button
              onClick={create}
              disabled={busy}
              className="inline-flex h-10 items-center bg-indigo-600 px-4 text-sm font-medium text-white active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create (paused)"}
            </button>
          </div>
        </>
      )}

      {error && (
        <div className="mt-3 text-[13px] leading-snug text-amber-700">
          {error.toLowerCase().includes("scope") || error.toLowerCase().includes("401") || error.toLowerCase().includes("403")
            ? "LinkedIn write failed — make sure you’re connected on this browser (Connections → Connect)."
            : `Couldn’t create the campaign: ${error}`}
        </div>
      )}

      {result?.ok && (
        <div className="text-[13px] leading-relaxed text-zinc-700">
          <div className="font-semibold text-green-700">✓ Campaign created (PAUSED){campaignId ? ` · #${campaignId}` : ""}</div>
          <div className="mt-1">
            Conversions {allConvOk ? <span className="text-green-700">attached ✓ (Quiz Completed + Purchase)</span> : <span className="text-amber-700">partly attached — check them in Campaign Manager</span>}
          </div>
          <div className="mt-3 border-t border-zinc-100 pt-2">
            <div className="mb-1 font-medium text-zinc-800">Finish in Campaign Manager, then launch:</div>
            <ol className="ml-4 list-decimal space-y-1">
              <li>Add your creative (reuse the cold ad).</li>
              <li>
                Set the destination URL to <code className="bg-zinc-100 px-1 text-[12px]">{DEST_URL}</code>
              </li>
              <li>Confirm bid = <strong>Maximum delivery</strong> (auto-bid).</li>
              <li>Un-pause to launch — run it alongside cold for 3–5 days and compare cost-per-quiz.</li>
            </ol>
          </div>
        </div>
      )}
    </Card>
  );
}
