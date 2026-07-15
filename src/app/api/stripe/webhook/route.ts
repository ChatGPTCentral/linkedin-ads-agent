import { NextRequest, NextResponse } from "next/server";
import { getStripeWebhookSecret } from "@/lib/stripe/config";
import { verifyStripeSignature, extractPurchase } from "@/lib/stripe/webhook";
import { getGa4MpEnv, sendGa4Purchase, clientIdFor } from "@/lib/google/ga4mp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe webhook → the server-side conversion loop. Catches every paid purchase
// at the source and reports real revenue to GA4 (Measurement Protocol). LinkedIn
// Conversions API is added next (Increment 2, needs rw_conversions).
export async function POST(req: NextRequest) {
  const secret = getStripeWebhookSecret();
  if (!secret) {
    return NextResponse.json({ error: "missing_config", missing: ["STRIPE_WEBHOOK_SECRET"] }, { status: 500 });
  }

  // Raw body is required for signature verification — do not JSON.parse first.
  const raw = await req.text();
  const v = verifyStripeSignature(raw, req.headers.get("stripe-signature"), secret);
  if (!v.ok) return NextResponse.json({ error: "invalid_signature", reason: v.reason }, { status: 400 });

  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const purchase = extractPurchase(event as Parameters<typeof extractPurchase>[0]);
  if (!purchase) {
    // Ack non-purchase events so Stripe doesn't retry.
    return NextResponse.json({ ok: true, ignored: (event as { type?: string }).type ?? null });
  }

  const out: Record<string, unknown> = {
    ok: true,
    type: purchase.type,
    transactionId: purchase.transactionId,
    valueUsd: purchase.valueUsd,
    currency: purchase.currency,
    livemode: purchase.livemode,
  };

  // → GA4 (real revenue), fire-and-report. A GA4 hiccup must NOT make Stripe
  // retry the whole event, so we still return 200 with the result attached.
  const ga = getGa4MpEnv();
  if (ga) {
    try {
      out.ga4 = await sendGa4Purchase(ga, {
        clientId: clientIdFor(purchase.transactionId),
        transactionId: purchase.transactionId,
        valueUsd: purchase.valueUsd,
        currency: purchase.currency,
      });
    } catch (e) {
      out.ga4 = { ok: false, error: (e as Error).message };
    }
  } else {
    out.ga4 = { skipped: "set GA4_MP_MEASUREMENT_ID + GA4_MP_API_SECRET" };
  }

  // Increment 2 (LinkedIn Conversions API) plugs in here once rw_conversions is granted.

  return NextResponse.json(out);
}
