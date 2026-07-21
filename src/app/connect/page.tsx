import { AUDIENCES, AD_COPY } from "@/data/linkedin";
import { LinkedInPanel } from "@/components/LinkedInPanel";
import { Callout } from "@/components/ui";

export default function ConnectPage() {
  const audiences = AUDIENCES.map((a) => ({
    id: a.id,
    name: a.name,
    copyId: AD_COPY.find((c) => c.pairsWith === a.name)?.id ?? AD_COPY[0]?.id,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Connections</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          The connected systems behind the funnel — LinkedIn Ads, Google, Stripe and the Quiz DB. Connect your LinkedIn ad account to
          read campaigns &amp; analytics, manage conversions &amp; saved audiences, and stage paused campaigns.
        </p>
      </div>

      <Callout tone="indigo" title="How this works">
        OAuth connects your LinkedIn developer app to your ad account (token stored encrypted, server-side). <strong>Live reach</strong>{" "}
        calls the Audience Counts API; <strong>Create draft campaign</strong> creates a PAUSED campaign group + campaign with the
        mapped targeting — you add the creative and launch in Campaign Manager. Requires the env vars in{" "}
        <span className="font-mono">docs/LINKEDIN.md</span>.
      </Callout>

      <LinkedInPanel audiences={audiences} />
    </div>
  );
}
