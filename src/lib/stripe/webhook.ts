import crypto from "node:crypto";

// Verify Stripe webhook signatures and pull a normalized purchase out of the
// event — without the Stripe SDK. Stripe signs `${t}.${rawBody}` with the
// endpoint secret (HMAC-SHA256, hex) and sends it in the `Stripe-Signature`
// header as `t=<ts>,v1=<sig>`.

export function verifyStripeSignature(
  rawBody: string,
  sigHeader: string | null,
  secret: string,
  toleranceSec = 300
): { ok: boolean; reason?: string } {
  if (!sigHeader) return { ok: false, reason: "no_signature" };
  const parts: Record<string, string> = {};
  for (const kv of sigHeader.split(",")) {
    const i = kv.indexOf("=");
    if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return { ok: false, reason: "malformed_signature" };

  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(v1);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: "signature_mismatch" };

  const ts = Number(t);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > toleranceSec) {
    return { ok: false, reason: "timestamp_out_of_tolerance" };
  }
  return { ok: true };
}

interface StripeEvent {
  type?: string;
  livemode?: boolean;
  data?: { object?: Record<string, unknown> };
}

export interface Purchase {
  email?: string;
  valueUsd: number;
  currency: string;
  transactionId: string;
  livemode: boolean;
  type: string;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

/** Normalize a paid Stripe event into a Purchase, or null for events we ignore. */
export function extractPurchase(event: StripeEvent): Purchase | null {
  const type = event.type ?? "";
  const obj = (event.data?.object ?? {}) as Record<string, unknown>;
  const livemode = event.livemode === true;

  if (type === "checkout.session.completed") {
    const paymentStatus = str(obj.payment_status);
    if (paymentStatus && paymentStatus !== "paid") return null; // e.g. "unpaid" async
    const details = obj.customer_details as Record<string, unknown> | undefined;
    return {
      email: str(details?.email) ?? str(obj.customer_email),
      valueUsd: (num(obj.amount_total) ?? 0) / 100,
      currency: (str(obj.currency) ?? "usd").toUpperCase(),
      transactionId: str(obj.id) ?? `cs_${Date.now()}`,
      livemode,
      type,
    };
  }

  if (type === "invoice.paid" || type === "invoice.payment_succeeded") {
    return {
      email: str(obj.customer_email),
      valueUsd: (num(obj.amount_paid) ?? 0) / 100,
      currency: (str(obj.currency) ?? "usd").toUpperCase(),
      transactionId: str(obj.id) ?? `inv_${Date.now()}`,
      livemode,
      type,
    };
  }

  return null;
}
