import crypto from "node:crypto";

// GA4 Measurement Protocol — send server-side `purchase` events (real revenue)
// straight to GA4, no gtag/GTM tag needed. Config comes from a Measurement
// Protocol API secret created in GA4 Admin → Data Streams → the stream.

export interface Ga4MpEnv {
  measurementId: string; // G-XXXXXXX
  apiSecret: string;
}

export function getGa4MpEnv(): Ga4MpEnv | null {
  const measurementId = process.env.GA4_MP_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_MP_API_SECRET;
  if (!measurementId || !apiSecret) return null;
  return { measurementId, apiSecret };
}

/**
 * GA4 requires a client_id. Server-side we have no `_ga` cookie, so derive a
 * stable one from the transaction id (deterministic → idempotent on retries).
 * Events still count revenue; they just won't join the original web session's
 * source/medium (pass the real `_ga` via Stripe metadata later for full join).
 */
export function clientIdFor(txn: string): string {
  const h = crypto.createHash("sha256").update(txn).digest();
  return `${h.readUInt32BE(0)}.${h.readUInt32BE(4)}`;
}

export async function sendGa4Purchase(
  env: Ga4MpEnv,
  p: { clientId: string; transactionId: string; valueUsd: number; currency: string }
): Promise<{ ok: boolean; status: number; error?: string }> {
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(env.measurementId)}&api_secret=${encodeURIComponent(env.apiSecret)}`;
  const payload = {
    client_id: p.clientId,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: p.transactionId,
          value: p.valueUsd,
          currency: p.currency,
          items: [{ item_id: p.transactionId, item_name: "Ultimate AI Library", price: p.valueUsd, quantity: 1 }],
        },
      },
    ],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  // MP returns 204 on success; body is empty.
  return res.ok ? { ok: true, status: res.status } : { ok: false, status: res.status, error: (await res.text()).slice(0, 300) };
}
