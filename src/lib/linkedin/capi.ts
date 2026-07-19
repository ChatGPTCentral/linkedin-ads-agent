import crypto from "node:crypto";
import { LINKEDIN } from "./config";

// LinkedIn Conversions API (CAPI) — server-side purchase events sent straight to
// LinkedIn with real revenue + a SHA-256-hashed email, so LinkedIn's optimizer
// learns who actually BUYS (true ROAS + value-based bidding). Ad-blocker-proof;
// the durable half of the conversion loop alongside the Insight Tag pixel.
//
// The access token here is NOT the OAuth app token (that's a per-browser cookie
// the webhook can't see) — it's a standalone LinkedIn Ads / CRM access token
// stored in env, used server-side from the Stripe webhook.

export interface CapiEnv {
  accessToken: string;
  conversionUrn: string; // urn:li:conversion:NNNN — the LinkedIn conversion rule
}

export function getCapiEnv(): CapiEnv | null {
  const accessToken = process.env.LINKEDIN_CAPI_ACCESS_TOKEN;
  const conversionUrn = process.env.LINKEDIN_CAPI_CONVERSION_URN;
  if (!accessToken || !conversionUrn) return null;
  return { accessToken, conversionUrn };
}

/** LinkedIn requires SHA-256 of the trimmed, lowercased email — never the raw address. */
function sha256Email(email: string): string {
  return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export interface CapiResult {
  ok: boolean;
  status?: number;
  error?: string;
}

/**
 * Send one purchase to LinkedIn's Conversions API. `eventId` = the Stripe
 * transaction id, so retries (and the Insight Tag pixel) de-duplicate.
 * Returns a small result object; never throws for a non-2xx (caller decides).
 */
export async function sendLinkedInConversion(
  env: CapiEnv,
  p: { email?: string; valueUsd: number; currency: string; transactionId: string; happenedAtMs: number }
): Promise<CapiResult> {
  const userIds: { idType: string; idValue: string }[] = [];
  if (p.email) userIds.push({ idType: "SHA256_EMAIL", idValue: sha256Email(p.email) });
  if (!userIds.length) return { ok: false, error: "no_user_identifier (need a hashed email)" };

  const body = {
    conversion: env.conversionUrn,
    conversionHappenedAt: p.happenedAtMs,
    conversionValue: {
      currencyCode: (p.currency || "USD").toUpperCase(),
      amount: p.valueUsd.toFixed(2),
    },
    eventId: p.transactionId,
    user: { userIds },
  };

  const res = await fetch(`${LINKEDIN.apiBase}/conversionEvents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.accessToken}`,
      "LinkedIn-Version": LINKEDIN.version,
      "X-Restli-Protocol-Version": LINKEDIN.restliVersion,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, error: (await res.text()).slice(0, 300) };
  }
  return { ok: true, status: res.status };
}
