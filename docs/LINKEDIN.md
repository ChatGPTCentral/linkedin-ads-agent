# LinkedIn Ads API integration

Connects the app to your LinkedIn ad account to drive a **measured, purchase-
optimized funnel**: **(1)** validate audience reach, **(2)** track conversions
via the Insight Tag, **(3)** create **paused**, conversion-optimized draft
campaigns, **(4)** report **CPA / ROAS**, and **(5)** build retargeting /
customer-exclusion / predictive audiences. Campaigns are always created
**PAUSED** — nothing spends money without a human launching it in Campaign Manager.

> Status: OAuth + token flow ready. Campaign create (group + campaign), audience
> reach, DMP list upload, and the conversion objective work end-to-end. Several
> **payload encodings are best-effort** and tuned against live responses — every
> route returns the raw LinkedIn error so we can iterate. **Creative creation is
> not yet automated** (add the creative in Campaign Manager for now).

## Conversion tracking (Insight Tag) — required to optimize for payers
1. In the app's **Conversion tracking** card, click **Load Insight Tag** (or copy
   the Partner ID from Campaign Manager → Analyze → Insight Tag).
2. Paste the snippet into your landing page `<head>` (Next.js: `next/script`
   with `strategy="afterInteractive"`). This app only *surfaces* the snippet.
3. Confirm the tag shows **Active** in Campaign Manager (first signal up to ~24h).
4. Create conversions (**Create PURCHASE / SIGN_UP conversion**) and, in Campaign
   Manager, tie each to a landing-page URL rule (purchase-confirmation → PURCHASE,
   trial/subscribe → SIGN_UP). Default conversion value = avg LTV ($47.74).
5. When creating a campaign, keep **Optimize for: Purchases** and pick the
   conversion so LinkedIn optimizes toward payers.
6. Once the tag has data, build a **website-retargeting** audience in Campaign
   Manager and a **customer-exclusion** list (paste purchaser emails → hashed),
   then use **Target / Exclude** on the Saved-audiences segments.

> Scopes: conversions run on the existing `r_ads`/`rw_ads`. If `/conversions`
> returns 403, add `rw_conversions` to `LINKEDIN.scopes` and **Disconnect →
> Connect** to re-consent (confirm the app has the scope first).
> **Matched Audiences (`/audiences`, `/predictive`) need `rw_dmp_segments`,
> which the LinkedIn app is NOT granted yet** — those routes return a 403 with
> a hint until the permission is requested on developer.linkedin.com and the
> scope is added back to `LINKEDIN.scopes`. Never request an ungranted scope:
> LinkedIn hard-fails the whole consent screen ("Bummer, something went wrong").

## 1. LinkedIn developer app
- App: **AI Central Media (Advertising API)**, client id `78evqi1gp64fub`, with
  the **Advertising API** product approved. Granted scopes we request:
  `r_ads`, `rw_ads`, `r_ads_reporting`, plus `r_organization_social` and
  `r_organization_admin` (org posts + page analytics — feed intelligence).
  Pending grant: `rw_dmp_segments` (Matched Audiences) — request it, then add
  it back to `LINKEDIN.scopes` and re-consent.
- Under **Auth**, add Authorized redirect URLs:
  - `http://localhost:3000/api/linkedin/callback` (local)
  - `https://<your-domain>/api/linkedin/callback` (production)

## 2. Environment variables
Set these in **Vercel → Settings → Environment Variables** (Production) and in
`.env.local` for local dev (see `.env.local.example`):

| Var | Value |
|-----|-------|
| `LINKEDIN_CLIENT_ID` | App's Client ID |
| `LINKEDIN_CLIENT_SECRET` | App's Client Secret |
| `LINKEDIN_REDIRECT_URI` | Exactly matches an authorized redirect URL above |
| `LINKEDIN_API_VERSION` | e.g. `202411` (optional) |
| `TOKEN_ENC_KEY` | `openssl rand -base64 32` (encrypts the token cookie) |

Redeploy after setting them.

## 3. Connect & use
1. Open **/connect** in the app.
2. Click **Connect LinkedIn** → authorize → you're redirected back connected.
3. Pick your **Ad account URN** (`urn:li:sponsoredAccount:…`).
4. **Live reach** → real Audience Counts for each designed audience.
5. **Create draft campaign** → PAUSED campaign group + campaign with mapped
   targeting; add a creative + review, then launch in Campaign Manager.

## Architecture
- `src/lib/linkedin/` — config, OAuth, encrypted cookie token store, REST client,
  facet→URN targeting resolver.
- `src/app/api/linkedin/*` — route handlers: `auth`, `callback`, `status`,
  `disconnect`, `audience-counts`, `analytics` (CPA/ROAS via `metrics.ts`),
  `campaigns` (conversion objective + segment include/exclude), `audiences`
  (DMP list read/create), `insight-tag`, `conversions`, `predictive`.
- Token: encrypted (AES-256-GCM) httpOnly cookie. Upgrade to Supabase if multiple
  operators need shared state.

## Known verification points (tune once live)
- `adTargetingEntities` typeahead query encoding (locations resolved via static GEO_URN instead).
- `audienceCounts` / `adAnalytics` query encoding; `conversionValueInLocalCurrency` field (auto-dropped if rejected).
- `POST /conversions` enum casing (`type`, `conversionMethod`) + value field name.
- `PUT /campaignConversions/(campaign:..,conversion:..)` compound-key encoding.
- Matched-audience facet urn for include/exclude (`audienceMatchingSegments` vs `dynamicSegments`).
- Predictive Audience creation (gated behind LinkedIn's private Matched Audiences API → CM fallback).
- Creative creation (image upload + sponsored post) — not yet implemented.
