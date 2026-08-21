# 📈 Stripe Revenue Simulator

A single-file, dependency-free tool that turns a **Stripe subscriptions CSV
export** into a forward-looking revenue forecast — *"the next revenues I should
be receiving"* — and lets you stress-test it with adjustable assumptions.

> **Privacy first.** Everything runs locally in your browser via the
> `FileReader` API. Your CSV (which contains customer emails) is **never
> uploaded, sent over the network, or written to disk by this tool**, and the
> raw export is **never committed to this repo**.

## Use it

1. Open `index.html` in any browser (double-click it, or serve the folder with
   `npx serve stripe-revenue-simulator`).
2. In Stripe, go to **Subscriptions → Export** and download the CSV.
3. Drag the CSV onto the drop zone (or click **Load demo data** to explore with
   synthetic numbers first).
4. Adjust the assumptions on the left and watch the forecast update live.

## What it shows

| Output | Meaning |
|--------|---------|
| **Headline cards** | Active subs, normalised MRR/ARR, expected revenue in the next 30 / 90 / 365 days, horizon total (gross + net), and MRR at risk from subs set to cancel. |
| **Monthly forecast chart** | Stacked bars per month — current subscriptions (purple) vs. projected new sales (green). Hover for the breakdown. |
| **Next revenues you should receive** | A chronological list of every upcoming charge from your current subscriptions, with date, customer (masked), product, amount and net. Exportable to CSV. |
| **Monthly detail + By product** | Tabular breakdowns of the same forecast. |

## The model

For every **live** subscription (`active` / `trialing` / `past_due`) the tool
projects each scheduled renewal charge starting at `Current Period End` and
recurring by its billing `Interval` (year / month / week / day):

- **Cancelling subs** (`Cancel At Period End = true`) contribute **$0** future
  revenue — at period end they end instead of renewing. (Toggle *"treat
  cancelling as renewing"* to override.)
- **Annual retention** (default **100%**) is applied geometrically to each
  future renewal. At 100% the forecast equals exactly what Stripe is scheduled
  to attempt; lower it to model voluntary churn. Monthly subs use the
  12th-root of the annual rate so a year of monthly renewals compounds to it.
- **Net of fees** subtracts a configurable Stripe fee (default `2.9% + $0.30`
  per charge).
- **What-if new sales** adds a monthly cohort of new subscriptions (count ×
  amount × interval) that then renew under the same retention curve. Default 0,
  so the base case is purely your existing book.
- **Multi-currency**: if the export contains more than one currency, an FX
  panel appears so you can convert everything into a chosen base currency.

### Parsing notes

- Amounts are parsed robustly across locales — `39,75`, `1.234,56` and
  `1,234.56` all resolve correctly (this account's export uses comma decimals).
- UTC timestamps (`YYYY-MM-DD HH:MM`) are parsed as UTC; CSV quoting, escaped
  quotes and embedded commas/newlines (e.g. product names with emojis) are
  handled by a small RFC-4180 parser.

## Not modelled (caveats shown in-app)

Failed/declined payments (involuntary churn), taxes, mid-cycle
upgrades/downgrades, refunds, proration, coupon discounts (the `Amount` column
is the plan price — a coupon may reduce the real charge), and FX drift. These
are surfaced as a caveats note under the results so the forecast is read
honestly.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The entire app — HTML, CSS and vanilla JS, no build step. |
| `sample-subscriptions.csv` | A small **synthetic** export (no real customers) showing the expected column format and for testing the upload flow. |
