import type { Metadata } from "next";
import Link from "next/link";
import { Card, Chip, Callout, StackedBar } from "@/components/ui";

export const metadata: Metadata = { title: "Strategy — AI Central" };

const FUNNEL = [
  { step: "Impression", kpi: "reach" },
  { step: "Click", kpi: "CPC" },
  { step: "Quiz completed", kpi: "Cost / quiz", star: true },
  { step: "Email lead", kpi: "Cost / lead" },
  { step: "$4.99 trial", kpi: "CAC vs LTV", star: true },
  { step: "Yearly / lifetime", kpi: "LTV $47.74" },
];

const AUDIENCES: { asset: string; stage: string; how: string; temp: string }[] = [
  { asset: "ICP — seniority × function × AI skills", stage: "Cold", how: "Manual targeting (campaign 1A-v2)", temp: "❄️" },
  { asset: "280k LinkedIn page followers", stage: "Warm", how: "“Company followers” targeting — cheap, high-trust", temp: "🔥" },
  { asset: "Beehiiv + GS lists", stage: "Warm", how: "Matched lists (campaign 1B)", temp: "🔥" },
  { asset: "cntral.ai short-link clickers", stage: "Warm", how: "Already pixeled via pxl.to → Website audience", temp: "🔥" },
  { asset: "All thecentral.ai visitors", stage: "Retarget", how: "Insight Tag website audience", temp: "♨️" },
  { asset: "Quiz visitors — didn’t finish", stage: "Retarget", how: "Website audience → “finish your score”", temp: "♨️" },
  { asset: "Quiz completers — didn’t buy", stage: "Convert", how: "Quiz-DB email list → the $4.99 offer", temp: "🔴" },
  { asset: "Predictive lookalike of 1,696 buyers", stage: "Cold scale", how: "Seed a Predictive Audience from buyers", temp: "❄️" },
];

const WAVES = [
  {
    n: "Wave 1",
    title: "Warm scoop",
    when: "this week",
    tone: "green" as const,
    goal: "Cheapest quiz-fills from people who already know you.",
    items: ["Followers (280k) → quiz", "Website + cntral.ai clickers → quiz"],
    creative: "Community / personal — “You follow us — see where you rank.”",
  },
  {
    n: "Wave 2",
    title: "Convert",
    when: "next",
    tone: "amber" as const,
    goal: "Turn warm quiz-completers into $4.99 trials.",
    items: ["Completers who didn’t buy → offer"],
    creative: "Direct offer — “Your score says X. Level up — $4.99 first month.”",
  },
  {
    n: "Wave 3",
    title: "Scale cold",
    when: "once economics hold",
    tone: "indigo" as const,
    goal: "Grow reach beyond your owned audiences.",
    items: ["Predictive lookalike of buyers", "ICP + interest expansion"],
    creative: "Curiosity + social proof — “What’s your AI Ready Score? 45,000+ took it.”",
  },
];

const CREATIVE = [
  { stage: "Cold / Predictive", angle: "Curiosity + proof", ex: "“What’s your AI Ready Score?”" },
  { stage: "Warm (followers/subs)", angle: "Community + personal", ex: "“You follow us — see where you rank.”" },
  { stage: "Retarget — abandoner", angle: "Loss aversion", ex: "“You started — your score’s waiting.”" },
  { stage: "Convert — didn’t buy", angle: "Direct offer", ex: "“Your score says X. The Library — $4.99.”" },
];

function StageChip({ stage }: { stage: string }) {
  const tone =
    stage.startsWith("Cold") ? "indigo" : stage === "Warm" ? "amber" : stage === "Convert" ? "green" : "violet";
  return <Chip tone={tone as "indigo" | "amber" | "green" | "violet"}>{stage}</Chip>;
}

export default function StrategyPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Full-Funnel Strategy</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          How ~$5k/mo moves people from ad → quiz → $4.99 trial → yearly/lifetime — and where every owned audience plugs in.
          Track live results in the{" "}
          <Link href="/" className="font-medium text-indigo-600 underline">
            cockpit
          </Link>
          .
        </p>
      </div>

      {/* Funnel & KPI ladder */}
      <Card title="The funnel & KPI ladder" subtitle="Optimize the starred metrics; the goalpost moves down as data thickens">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FUNNEL.map((f, i) => (
            <div key={i} className="flex shrink-0 items-center gap-2">
              <div className={`rounded-lg border px-3 py-2 text-center ${f.star ? "border-indigo-300 bg-indigo-50" : "border-zinc-200 bg-white"}`}>
                <div className="text-xs font-semibold text-zinc-800">
                  {f.star && "🎯 "}
                  {f.step}
                </div>
                <div className="mt-0.5 text-[11px] text-zinc-500">{f.kpi}</div>
              </div>
              {i < FUNNEL.length - 1 && <span className="text-zinc-300">→</span>}
            </div>
          ))}
        </div>
      </Card>

      {/* Budget allocation */}
      <Card title="Budget — a ramped split, not an even one" subtitle="Earn the cold budget with proof; start warm-heavy">
        <div className="space-y-5">
          <div>
            <div className="mb-2 text-xs font-medium text-zinc-500">Now — validate (warm-heavy)</div>
            <StackedBar
              segments={[
                { label: "Cold (ICP + Predictive)", value: 35, color: "bg-sky-500", hint: "35%" },
                { label: "Warm (followers, subs, clicks)", value: 40, color: "bg-orange-500", hint: "40%" },
                { label: "Retarget / Convert", value: 25, color: "bg-rose-500", hint: "25%" },
              ]}
            />
          </div>
          <div>
            <div className="mb-2 text-xs font-medium text-zinc-500">Scaled — once cost/quiz & cost/trial hold</div>
            <StackedBar
              segments={[
                { label: "Cold (ICP + Predictive)", value: 55, color: "bg-sky-500", hint: "55%" },
                { label: "Warm", value: 25, color: "bg-orange-500", hint: "25%" },
                { label: "Retarget / Convert", value: 20, color: "bg-rose-500", hint: "20%" },
              ]}
            />
          </div>
        </div>
        <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
          Scale campaigns whose <strong>cost-per-quiz</strong> (now) and later <strong>cost-per-trial</strong> stay under target; pause the rest.
        </p>
      </Card>

      {/* Audience architecture */}
      <Card title="Audience architecture" subtitle="Every owned asset mapped to a funnel stage">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs text-zinc-400">
                <th className="py-2 pr-3 font-medium">Asset</th>
                <th className="py-2 pr-3 font-medium">Stage</th>
                <th className="py-2 pr-3 font-medium">How to target</th>
                <th className="py-2 font-medium">Temp</th>
              </tr>
            </thead>
            <tbody>
              {AUDIENCES.map((a, i) => (
                <tr key={i} className="border-b border-zinc-100 align-top">
                  <td className="py-2 pr-3 font-medium text-zinc-800">{a.asset}</td>
                  <td className="py-2 pr-3">
                    <StageChip stage={a.stage} />
                  </td>
                  <td className="py-2 pr-3 text-zinc-600">{a.how}</td>
                  <td className="py-2">{a.temp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Waves */}
      <div className="grid gap-4 lg:grid-cols-3">
        {WAVES.map((w) => (
          <Card key={w.n} title={`${w.n} · ${w.title}`} subtitle={w.when}>
            <p className="text-sm text-zinc-600">{w.goal}</p>
            <ul className="mt-3 space-y-1.5">
              {w.items.map((it, i) => (
                <li key={i} className="flex gap-1.5 text-sm text-zinc-700">
                  <span className="text-zinc-300">•</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
            <Callout tone={w.tone === "green" ? "green" : w.tone === "amber" ? "amber" : "indigo"}>
              <span className="text-xs">
                <span className="font-semibold">Creative:</span> {w.creative}
              </span>
            </Callout>
          </Card>
        ))}
      </div>

      {/* Creative angles */}
      <Card title="Creative by temperature" subtitle="Same quiz, four different messages — the biggest lift">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs text-zinc-400">
                <th className="py-2 pr-3 font-medium">Stage</th>
                <th className="py-2 pr-3 font-medium">Angle</th>
                <th className="py-2 font-medium">Example</th>
              </tr>
            </thead>
            <tbody>
              {CREATIVE.map((c, i) => (
                <tr key={i} className="border-b border-zinc-100">
                  <td className="py-2 pr-3 font-medium text-zinc-800">{c.stage}</td>
                  <td className="py-2 pr-3 text-zinc-600">{c.angle}</td>
                  <td className="py-2 text-zinc-600">{c.ex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Predictive + pipeline */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Predictive audiences" subtitle="LinkedIn’s lookalike engine — for cold scale">
          <p className="text-sm text-zinc-600">
            Seed a Predictive Audience from your best signal and LinkedIn finds similar professionals. Best seeds, in order:
          </p>
          <ol className="mt-3 space-y-1.5 text-sm text-zinc-700">
            <li>1. <strong>Buyers</strong> (1,696 customers) — highest-intent lookalike</li>
            <li>2. <strong>Quiz completers</strong> — volume seed</li>
            <li>3. <strong>280k followers</strong> — massive quality seed</li>
          </ol>
          <p className="mt-3 text-xs text-zinc-500">
            Seed it in Campaign Manager’s UI (upload buyer emails → create Predictive). The API path needs the pending{" "}
            <code className="rounded bg-zinc-100 px-1">rw_dmp_segments</code> scope.
          </p>
        </Card>

        <Card title="Pipeline flow" subtitle="One person’s path — and the retarget loops">
          <div className="space-y-2 text-sm text-zinc-700">
            <div className="rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed">
              <span className="font-medium">Followers · Subs · Cold ICP · Predictive</span> → ad → quiz landing →{" "}
              <span className="font-medium text-indigo-700">🎯 quiz completed</span> (Insight Tag + quiz DB) → email lead → beehiiv
              nurture → <span className="font-medium text-green-700">$4.99 trial</span> (CAPI) → yearly / lifetime
            </div>
            <div className="text-xs text-zinc-500">
              ↩︎ <strong>Retarget loops:</strong> didn’t-finish → back to quiz · didn’t-buy → the offer
            </div>
          </div>
        </Card>
      </div>

      <p className="text-xs text-zinc-400">
        Live spend, cost-per-quiz and the lead feed are in the cockpit. This page is the plan the campaigns execute against.
      </p>
    </div>
  );
}
