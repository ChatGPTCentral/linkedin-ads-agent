// Stripe webhook config. We only RECEIVE and verify webhook events — no Stripe
// SDK and no Stripe API calls — so all we need is the endpoint signing secret.

export function getStripeWebhookSecret(): string | undefined {
  return process.env.STRIPE_WEBHOOK_SECRET;
}
