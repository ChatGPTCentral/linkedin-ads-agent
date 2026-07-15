# Server-side conversion loop — Stripe webhook → GA4 (+ LinkedIn next)

Because checkout is 100% on Stripe, we capture every purchase at the source
(a Stripe webhook) instead of relying on fragile browser pixels. Increment 1
reports real revenue to **GA4** via the Measurement Protocol. Increment 2 adds
the **LinkedIn Conversions API** (needs the `rw_conversions` scope).

Endpoint: `POST /api/stripe/webhook` (`src/app/api/stripe/webhook/route.ts`).
No Stripe SDK — signatures are verified with HMAC-SHA256 over the raw body.

## Setup
1. **Stripe → Developers → Webhooks → Add endpoint**
   - URL: `https://linkedin-ads-agent-alexs-projects-566a42f9.vercel.app/api/stripe/webhook`
   - Events: `checkout.session.completed` (and optionally `invoice.paid`).
   - After creating it, click **Reveal** the **Signing secret** (`whsec_…`).
2. **GA4 → Admin → Data streams →** the thecentral.ai web stream **→
   Measurement Protocol API secrets → Create**. Copy the **secret value**, and
   note the stream's **Measurement ID** (`G-…`).
3. **Vercel → Settings → Environment Variables (Production)** then redeploy:

   | Var | Value |
   |-----|-------|
   | `STRIPE_WEBHOOK_SECRET` | the `whsec_…` from step 1 |
   | `GA4_MP_MEASUREMENT_ID` | the `G-…` from step 2 |
   | `GA4_MP_API_SECRET` | the secret value from step 2 |

## Test
- Stripe dashboard → your webhook → **Send test event** →
  `checkout.session.completed`. The endpoint returns
  `{ ok: true, ga4: { ok: true, status: 204 }, … }`.
- In GA4 → **Reports → Realtime** (or DebugView) you'll see a `purchase` event.
- Note: server-side events count revenue but won't join the buyer's original
  web session's source/medium (no `_ga` client_id). Fine for revenue totals;
  to attribute to the original session, pass the visitor's `_ga` value through
  Stripe `metadata` at checkout and use it as the client_id (later).

## Increment 2 — LinkedIn Conversions API (next)
Once the LinkedIn app is granted `rw_conversions`, the same webhook will also
POST `/rest/conversionEvents` with the conversion URN, `conversionValue`, and a
SHA-256-hashed email → real LinkedIn conversions with revenue (true ROAS +
value-based bidding). Env to add then: `LINKEDIN_CAPI_CONVERSION_URN`.
